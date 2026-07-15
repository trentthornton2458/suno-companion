import axios, { AxiosInstance } from 'axios';
import * as cookie from 'cookie';
import { randomUUID } from 'crypto';

export interface SunoConfig {
  cookieString: string;
  twoCaptchaKey?: string;
}

export class SunoClient {
  private static BASE_URL = 'https://studio-api.prod.suno.com';
  private static CLERK_BASE_URL = 'https://auth.suno.com';
  private static CLERK_VERSION = '5.117.0';

  private client: AxiosInstance;
  private parsedCookies: Record<string, string>;
  private deviceId: string;
  private sid?: string;
  private currentToken?: string;
  private userAgent: string;

  constructor(config: SunoConfig) {
    this.parsedCookies = cookie.parse(config.cookieString) as Record<string, string>;
    this.deviceId = this.parsedCookies.ajs_anonymous_id || randomUUID();
    this.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    this.client = axios.create({
      withCredentials: true,
      headers: {
        'Affiliate-Id': 'undefined',
        'Device-Id': `"${this.deviceId}"`,
        'x-suno-client': 'Android prerelease-4nt180t 1.0.42',
        'X-Requested-With': 'com.suno.android',
        'sec-ch-ua': '"Chromium";v="130", "Android WebView";v="130", "Not?A_Brand";v="99"',
        'sec-ch-ua-mobile': '?1',
        'sec-ch-ua-platform': '"Android"',
        'User-Agent': this.userAgent,
      },
    });

    // Add interceptors to handle cookie sync and JWT auth
    this.client.interceptors.request.use((reqConfig) => {
      if (this.currentToken && !reqConfig.headers.Authorization) {
        reqConfig.headers.Authorization = `Bearer ${this.currentToken}`;
      }
      
      const cookiesArray = Object.entries(this.parsedCookies).map(([key, value]) =>
        cookie.serialize(key, value)
      );
      reqConfig.headers.Cookie = cookiesArray.join('; ');
      return reqConfig;
    });

    this.client.interceptors.response.use((response) => {
      const setCookieHeader = response.headers['set-cookie'];
      if (Array.isArray(setCookieHeader)) {
        const newCookies = cookie.parse(setCookieHeader.join('; ')) as Record<string, string>;
        for (const [key, value] of Object.entries(newCookies)) {
          this.parsedCookies[key] = value;
        }
      }
      return response;
    });
  }

  /**
   * Initializes the client by checking Clerk and getting a session token
   */
  public async init(): Promise<SunoClient> {
    await this.getAuthToken();
    await this.keepAlive();
    return this;
  }

  /**
   * Fetches the active Clerk session ID (sid)
   */
  private async getAuthToken() {
    const __client = this.parsedCookies.__client;
    if (!__client) {
      throw new Error('Suno cookie is missing "__client" token. Please copy the full cookie from Suno.');
    }

    const getSessionUrl = `${SunoClient.CLERK_BASE_URL}/v1/client?__clerk_api_version=2025-11-10&_clerk_js_version=${SunoClient.CLERK_VERSION}`;
    const sessionResponse = await this.client.get(getSessionUrl, {
      headers: { Authorization: __client },
    });

    const sid = sessionResponse.data?.response?.last_active_session_id;
    if (!sid) {
      throw new Error('Failed to get session ID from Clerk. Your Suno cookie might be expired.');
    }
    this.sid = sid;
  }

  /**
   * Refreshes the active JWT token
   */
  public async keepAlive(): Promise<void> {
    if (!this.sid) {
      throw new Error('Client not initialized. Call init() first.');
    }

    const __client = this.parsedCookies.__client;
    const renewUrl = `${SunoClient.CLERK_BASE_URL}/v1/client/sessions/${this.sid}/tokens?__clerk_api_version=2025-11-10&_clerk_js_version=${SunoClient.CLERK_VERSION}`;
    const renewResponse = await this.client.post(renewUrl, {}, {
      headers: { Authorization: __client },
    });

    this.currentToken = renewResponse.data.jwt;
  }

  /**
   * Checks if captcha validation is required for generation
   */
  public async checkCaptchaRequired(): Promise<boolean> {
    await this.keepAlive();
    const response = await this.client.post(`${SunoClient.BASE_URL}/api/c/check`, {
      ctype: 'generation',
    });
    return response.data.required;
  }

  /**
   * Core generator method
   */
  private async generateSongs(payload: {
    prompt: string;
    isCustom: boolean;
    tags?: string;
    title?: string;
    make_instrumental?: boolean;
    model?: string;
    negative_tags?: string;
    task?: string;
    continue_clip_id?: string;
    continue_at?: number;
  }) {
    await this.keepAlive();

    const captchaRequired = await this.checkCaptchaRequired();
    if (captchaRequired) {
      throw new Error('Suno API requires CAPTCHA verification. Please renew your cookie or solve it on the web app.');
    }

    const modelToUse = payload.model || 'chirp-v3-5';
    
    const requestPayload: any = {
      make_instrumental: !!payload.make_instrumental,
      mv: modelToUse,
      prompt: '',
      generation_type: 'TEXT',
      continue_at: payload.continue_at || null,
      continue_clip_id: payload.continue_clip_id || null,
      task: payload.task || null,
      token: null, // Captcha bypassed / not required
    };

    if (payload.isCustom) {
      requestPayload.tags = payload.tags || '';
      requestPayload.title = payload.title || '';
      requestPayload.negative_tags = payload.negative_tags || '';
      requestPayload.prompt = payload.prompt || '';
    } else {
      requestPayload.gpt_description_prompt = payload.prompt || '';
    }

    const response = await this.client.post(
      `${SunoClient.BASE_URL}/api/generate/v2/`,
      requestPayload,
      { timeout: 15000 }
    );

    if (response.status !== 200) {
      throw new Error(`Suno generation failed with status ${response.status}: ${response.statusText}`);
    }

    return response.data.clips;
  }

  /**
   * Normal Text-to-Music prompt generation
   */
  public async generate(prompt: string, makeInstrumental: boolean, model?: string) {
    return this.generateSongs({
      prompt,
      isCustom: false,
      make_instrumental: makeInstrumental,
      model,
    });
  }

  /**
   * Custom mode generation with lyrics, tags, and title
   */
  public async customGenerate(params: {
    prompt: string;
    tags: string;
    title: string;
    makeInstrumental: boolean;
    model?: string;
    negativeTags?: string;
  }) {
    return this.generateSongs({
      prompt: params.prompt,
      isCustom: true,
      tags: params.tags,
      title: params.title,
      make_instrumental: params.makeInstrumental,
      model: params.model,
      negative_tags: params.negativeTags,
    });
  }

  /**
   * Extend a song from a specific timestamp
   */
  public async extendAudio(params: {
    clipId: string;
    continueAt: number;
    prompt?: string;
    tags?: string;
    title?: string;
    negativeTags?: string;
    makeInstrumental?: boolean;
    model?: string;
  }) {
    return this.generateSongs({
      prompt: params.prompt || '',
      isCustom: true,
      tags: params.tags,
      title: params.title,
      make_instrumental: params.makeInstrumental,
      model: params.model,
      negative_tags: params.negativeTags,
      task: 'extend',
      continue_clip_id: params.clipId,
      continue_at: params.continueAt,
    });
  }

  /**
   * Concatenate song extensions
   */
  public async concatenate(clipId: string) {
    await this.keepAlive();
    const response = await this.client.post(
      `${SunoClient.BASE_URL}/api/generate/concat/v2/`,
      { clip_id: clipId },
      { timeout: 15000 }
    );
    return response.data;
  }

  /**
   * Generate stems (separate vocals and instrumental)
   */
  public async generateStems(clipId: string) {
    await this.keepAlive();
    const response = await this.client.post(
      `${SunoClient.BASE_URL}/api/edit/stems/${clipId}`,
      {},
      { timeout: 15000 }
    );
    return response.data;
  }

  /**
   * Retrieves active subscription limits and usage details
   */
  public async getLimit() {
    await this.keepAlive();
    const response = await this.client.get(`${SunoClient.BASE_URL}/api/billing/info/`);
    return {
      creditsLeft: response.data.total_credits_left,
      period: response.data.period,
      monthlyLimit: response.data.monthly_limit,
      monthlyUsage: response.data.monthly_usage,
    };
  }

  /**
   * Retrieve song feed (active/past generations)
   */
  public async getFeed(songIds?: string[], page?: number) {
    await this.keepAlive();
    const url = new URL(`${SunoClient.BASE_URL}/api/feed/v2`);
    if (songIds && songIds.length > 0) {
      url.searchParams.append('ids', songIds.join(','));
    }
    if (page) {
      url.searchParams.append('page', String(page));
    }

    const response = await this.client.get(url.toString());
    return response.data.clips;
  }

  /**
   * Retrieve info for a single clip
   */
  public async getClip(clipId: string) {
    await this.keepAlive();
    const response = await this.client.get(`${SunoClient.BASE_URL}/api/clip/${clipId}`);
    return response.data;
  }
}

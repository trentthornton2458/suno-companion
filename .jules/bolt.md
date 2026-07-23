# Bolt's Journal - Critical Learnings

## 2026-07-23 - [Caching and Memoization in Real-time Lyric/Meter Analysis]
**Learning:** In interactive applications involving complex, real-time analytics (such as text syllable counting and rhyming calculations), calling intensive string manipulation and heavy regex-based functions on every render causes severe UI lag. Moreover, trigger events like typing in unrelated input fields, slider movements, or polling intervals cause redundant full-text re-analysis if the main text state is unchanged.
**Action:** Always wrap heavy computations in `useMemo` with minimal dependencies, and leverage granular caching (e.g., word-level and line-level caches) to avoid repeating expensive regex parsing and phonetic extraction.

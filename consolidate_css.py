import re

with open('src/index.css', 'r') as f:
    content = f.read()

# Find all @media (max-width: 768px) blocks
blocks = re.findall(r'@media \(max-width: 768px\) \{(.*?)\n\s*\}\n', content, re.DOTALL)

# Remove all existing media blocks (except the first one, which we'll expand)
# Actually, let's just remove all of them and append one unified block.
cleaned_content = re.sub(r'@media \(max-width: 768px\) \{.*?\}\n(?!.*?\})', '', content, flags=re.DOTALL)
# The regex above is tricky with nested braces. Let's do it manually.

parts = content.split('@media (max-width: 768px) {')
base_css = parts[0]
media_content = ""

for part in parts[1:]:
    # Find the closing brace of the media query
    # Simple counting of braces
    brace_count = 1
    i = 0
    while i < len(part) and brace_count > 0:
        if part[i] == '{':
            brace_count += 1
        elif part[i] == '}':
            brace_count -= 1
        i += 1

    media_content += part[:i-1] + "\n"
    base_css += part[i:]

unified_media = """
/* Mobile Responsiveness */
@media (max-width: 768px) {
""" + media_content + "\n}\n"

with open('src/index.css', 'w') as f:
    f.write(base_css + unified_media)

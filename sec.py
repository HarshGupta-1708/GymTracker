import requests
import re

def decode_secret_message(url: str):
    response = requests.get(url)
    text = response.text

    # Extract only useful values (numbers + characters)
    tokens = re.findall(r'\d+|[^\s\d]', text)

    entries = []
    i = 0

    while i + 2 < len(tokens):
        try:
            x = int(tokens[i])
            char = tokens[i + 1]
            y = int(tokens[i + 2])
            entries.append((char, x, y))
            i += 3
        except:
            i += 1

    if not entries:
        print("Parsing failed")
        return

    max_x = max(x for _, x, _ in entries)
    max_y = max(y for _, _, y in entries)

    grid = [[" " for _ in range(max_x + 1)] for _ in range(max_y + 1)]

    for char, x, y in entries:
        grid[y][x] = char

    for row in grid:
        print("".join(row))


decode_secret_message(
    "https://docs.google.com/document/d/e/2PACX-1vSvM5gDlNvt7npYHhp_XfsJvuntUhq184By5xO_pA4b_gCWeXb6dM6ZxwN8rE6S4ghUsCj2VKR21oEP/pub"
)
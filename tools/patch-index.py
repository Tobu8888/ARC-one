#!/usr/bin/env python3
"""Tidies the mirrored index.html for the GitHub Pages copy.

The build comes out of Arc Studio with the host's own metadata baked in: a
Hugging Face bootstrap script, an og:title of "Arc Studio App" and a thumbnail
served from the Space. On the Pages copy those describe the wrong thing and the
tab falls back to whatever favicon the host happened to ship.

    python3 patch-index.py <index.html> [siteUrl]
"""

import re
import sys

ICONS = (
    '    <link rel="icon" type="image/png" href="./logo.png" />\n'
    '    <link rel="apple-touch-icon" href="./logo.png" />\n'
    '    <link rel="shortcut icon" href="./favicon.ico" />\n'
)

TITLE = "ARCone — Cross-border USDC payouts with withholding tax"
DESCRIPTION = (
    "Pay overseas contractors in USDC on Arc and withhold tax in the same "
    "transaction. Non-custodial, live on Arc mainnet."
)


def patch(html: str, site: str) -> str:
    # Drop the host bootstrap script; it does nothing outside that host.
    html = re.sub(r'<script>window\.huggingface=.*?</script>', '', html, flags=re.S)

    # Replace the social metadata that still names the host's template.
    html = re.sub(r'<meta property="og:title"[^>]*>', '', html)
    html = re.sub(r'<meta property="og:image"[^>]*>', '', html)
    html = re.sub(r'<meta name="twitter:image"[^>]*>', '', html)
    html = re.sub(r'<meta name="twitter:card"[^>]*>', '', html)

    meta = (
        f'    <meta name="description" content="{DESCRIPTION}" />\n'
        f'    <meta property="og:title" content="{TITLE}" />\n'
        f'    <meta property="og:description" content="{DESCRIPTION}" />\n'
        f'    <meta property="og:image" content="{site}/arc_one.png" />\n'
        f'    <meta property="og:url" content="{site}/" />\n'
        f'    <meta name="twitter:card" content="summary_large_image" />\n'
        f'    <meta name="twitter:image" content="{site}/arc_one.png" />\n'
    )

    if 'rel="icon"' not in html:
        html = html.replace('</head>', ICONS + meta + '  </head>')
    else:
        html = html.replace('</head>', meta + '  </head>')

    return html


def main() -> None:
    if len(sys.argv) < 2:
        print('usage: patch-index.py <index.html> [siteUrl]', file=sys.stderr)
        raise SystemExit(1)

    path = sys.argv[1]
    site = (sys.argv[2] if len(sys.argv) > 2 else 'https://tobu8888.github.io').rstrip('/')

    with open(path, encoding='utf-8') as fh:
        original = fh.read()

    patched = patch(original, site)
    with open(path, 'w', encoding='utf-8') as fh:
        fh.write(patched)

    print('patched', path)
    print('  icons   :', patched.count('rel="icon"'), 'link(s)')
    print('  og:title:', TITLE)


if __name__ == '__main__':
    main()

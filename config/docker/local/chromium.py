#!/usr/bin/python3
"""Keep the packaged agent-browser driver from disabling Chromium isolation."""
import os
import sys

# agent-browser 0.39.4 injects these defaults. Use Chromium's user namespace sandbox.
ignored = {'--no-sandbox', '--disable-setuid-sandbox'}
rejected = {
    '--disable-seccomp-filter-sandbox', '--disable-namespace-sandbox',
    '--disable-gpu-sandbox', '--no-zygote-sandbox', '--single-process',
    '--disable-web-security', '--ignore-certificate-errors',
    '--ignore-certificate-errors-spki-list', '--allow-running-insecure-content',
    '--disable-site-isolation-trials',
}
args = []
for argument in sys.argv[1:]:
    flag = argument.split('=', 1)[0]
    if flag in rejected:
        raise SystemExit(f'Orca container refuses insecure Chromium flag: {flag}')
    if flag not in ignored:
        args.append(argument)
args += [
    '--disable-breakpad', '--disable-crash-reporter', '--disable-component-update',
    '--disable-background-networking', '--disable-sync', '--no-first-run',
]
os.execv('/usr/bin/chromium', ['/usr/bin/chromium', *args])

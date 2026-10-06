"""The check harness must reject broken syntax, browser exceptions and console errors."""
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

source = Path(__file__).resolve().parent.parent
with tempfile.TemporaryDirectory() as directory:
    root = Path(directory)
    (root / 'tools').mkdir()
    (root / 'js').mkdir()
    shutil.copy(source / 'tools/check.sh', root / 'tools/check.sh')
    (root / 'js/broken.js').write_text('const = invalid;')
    (root / 'tools/owl_audio_check.cjs').write_text('')
    (root / 'tools/smoke.py').write_text('')
    result = subprocess.run(['sh', str(root / 'tools/check.sh')], capture_output=True, text=True)
    assert result.returncode != 0 and 'SyntaxError' in result.stderr, result
    print('invalid syntax fails the check command')

    shutil.rmtree(root / 'js')
    shutil.copytree(source / 'js', root / 'js')
    shutil.copytree(source / 'css', root / 'css')
    shutil.copy(source / 'tools/smoke.py', root / 'tools/smoke.py')
    original = (source / 'index.html').read_text()
    for script in ["console.error('smoke regression sentinel')", "throw new Error('smoke regression sentinel')"]:
        (root / 'index.html').write_text(original.replace('</head>', f'<script>{script}</script></head>'))
        result = subprocess.run([sys.executable, str(root / 'tools/smoke.py')], capture_output=True, text=True)
        assert result.returncode != 0 and 'Game emitted browser errors: smoke regression sentinel' in result.stderr, result
        print('browser failure correctly rejects smoke test:', script)
print('check harness failure detection passed')

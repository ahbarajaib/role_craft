import subprocess
from pathlib import Path

upload_dir = Path('uploads')
docx_files = list(upload_dir.glob('*.docx'))
if docx_files:
    docx_path = docx_files[0].resolve()
    pdf_path = docx_path.with_suffix('.pdf')
    print('Testing docx_path:', docx_path)

    as_script = f'''
    tell application "Microsoft Word"
        open posix file "{docx_path}"
        save as active document file format format PDF file name "{pdf_path}"
        close active document saving no
    end tell
    '''
    res = subprocess.run(['osascript', '-e', as_script], capture_output=True, text=True, check=False)
    print('returncode:', res.returncode)
    print('stdout:', res.stdout)
    print('stderr:', res.stderr)
    print('PDF exists:', pdf_path.exists())

"""Read-only owner-permission baseline check; never accepts changes automatically."""
import hashlib
import json
from pathlib import Path
import sys


def changed_files(root, baseline):
    expected = baseline['sha256']
    paths = set()
    for scope in baseline['scope']:
        item = root / scope
        if item.is_dir():
            paths.update(p.relative_to(root).as_posix() for p in item.rglob('*') if p.is_file())
        elif item.is_file():
            paths.add(scope)
    return [name for name in sorted(paths | set(expected))
            if (hashlib.sha256((root / name).read_bytes()).hexdigest()
                if (root / name).is_file() else None) != expected.get(name)]


def main():
    root = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent
    changes = changed_files(root, json.loads((root / 'docs/game-lock-baseline.json').read_text()))
    if changes:
        print('GAME LOCK: explicit owner unlock and review required.\n' + '\n'.join(changes))
        return 1
    print('GAME LOCK: protected files match approved baseline.')
    return 0


if __name__ == '__main__':
    sys.exit(main())

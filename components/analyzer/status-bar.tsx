"use client";

export function StatusBar() {
  return (
    <footer className="status-bar" role="contentinfo" aria-label="Keyboard shortcuts">
      <span>
        <kbd>Click</kbd> select &nbsp;<kbd>Shift+Click</kbd> range &nbsp;
        <kbd>{"\u2190"}/{"\u2192"}</kbd> move &nbsp;
        <kbd>{"\u2191"}/{"\u2193"}</kbd> row
      </span>
      <span>
        <kbd>1-9</kbd> position &nbsp;<kbd>0</kbd>=10 &nbsp;<kbd>X</kbd> pos
        n/a &nbsp;<kbd>N</kbd> not-in-race &nbsp;<kbd>R</kbd> in-race
        &nbsp;(1-24 positions)
      </span>
      <span>
        <kbd>Tab</kbd> next unlabeled &nbsp;<kbd>Ctrl+A</kbd> all &nbsp;
        <kbd>Esc</kbd> deselect &nbsp;<kbd>Del</kbd> clear
      </span>
    </footer>
  );
}

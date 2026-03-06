# Terminal Renderer Specification

The renderer must emulate a fixed-width terminal grid.

Current implementation embeds style tokens inside strings. This causes layout errors because the buffer counts token characters but the browser hides them.

This must be replaced with a grid cell renderer.

## Core concept

The server produces a buffer consisting of:

cells[x][y] = {
  char: "A",
  fg: "green",
  bg: "black",
  bold: false,
  dim: false
}

The client renders the grid as HTML spans.

## Rules

1. Style must not exist inside the text string.
2. Layout calculations must only use visible characters.
3. Each cell must represent exactly one visible character.
4. Tokens are converted into style changes when constructing cells.

## Supported colors

- green
- red
- yellow
- cyan
- magenta
- white
- blue

## Rendering

Client should render rows like:

<span class="fg-green">Hello</span>

Never:

`[c:green]Hello`

## Layout guarantees

- width calculations must ignore styling
- centered text must remain centered
- columns must remain aligned
- separators must remain aligned

## Goal

The renderer must behave like a BBS terminal, not a styled text viewer.
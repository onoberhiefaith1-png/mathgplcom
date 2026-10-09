# Geometry Map writing surface

## Goal

Turn the property editor into **two rectangle levels only**:

1. One large, spacious writing surface for the complete property.
2. The existing small identity shells around picked diagram parts such as `AB` and `AC²`.

The tight outline that currently grows around the whole equation will be removed. Its editing behaviour remains, but the large surface becomes its visible boundary.

## Result

- The writing area starts wide and comfortably tall instead of hugging the current text.
- Long properties can use the available width without being trapped by a second outline.
- Fractions, denominators, powers, roots, and other tall structures increase the surface height without clipping.
- The small coloured shells around diagram references remain unchanged.
- Picking diagram parts, keyboard shortcuts, Add function, Undo, Clear, and Add property continue to work as they do now.

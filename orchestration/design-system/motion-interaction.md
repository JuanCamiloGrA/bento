# Motion And Interaction

Motion is functional and minimal.

## Motion

- Use short transitions, `100ms` to `180ms`.
- Animate opacity/transform only.
- Respect `prefers-reduced-motion`.
- Do not animate virtualized item sizes.

## Interactions

- Global search focuses with `Cmd/Ctrl+K`.
- Escape closes menus, dialogs, and lightbox.
- Context menus support mouse and keyboard.
- Drag-and-drop upload must show target state and accept fallback file picker.
- Delete is logical delete; confirm destructive actions.
- Retry job action must be explicit.
- Indexing state is shown inline, not as a blocking modal.

## Feedback

- Upload shows immediate progress and then background indexing state.
- Failed partial processing shows warning state but asset remains accessible.
- Search results show match explanation.
- Empty states are concise and actionable.

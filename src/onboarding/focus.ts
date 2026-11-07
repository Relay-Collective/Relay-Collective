// Moves focus to the first field with an error, after it renders
export function focusFirstError() {
  requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid="true"] input')?.focus())
}

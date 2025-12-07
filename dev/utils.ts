export const throttle = <T extends unknown[]>(
  fn: (...args: T) => void,
  delay: number
) => {
  let timeout: ReturnType<typeof setTimeout> | null = null
  let last = Number.MIN_SAFE_INTEGER

  return (...args: T) => {
    if (timeout) {
      clearTimeout(timeout)
    }
    if (last + delay < Date.now()) {
      last = Date.now()
      fn(...args)
      return
    }
    timeout = setTimeout(() => {
      last = Date.now()
      fn(...args)
    }, delay)
  }
}

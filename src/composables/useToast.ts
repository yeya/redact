import { ref } from 'vue';

// Module-level singleton state — any component can `show()`, AppToast renders.
const visible = ref(false);
const message = ref('');
const ok = ref(true);
let timer: ReturnType<typeof setTimeout> | undefined;

export function useToast() {
  function show(msg: string, isOk = true): void {
    message.value = msg;
    ok.value = isOk;
    visible.value = true;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      visible.value = false;
    }, 2500);
  }

  return { visible, message, ok, show };
}

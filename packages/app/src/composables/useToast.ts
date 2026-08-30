import { reactive } from 'vue';

export interface ToastMessage {
	id: number;
	severity: 'error' | 'success' | 'info';
	summary: string;
	detail?: string;
	life: number;
}

const messages = reactive<ToastMessage[]>([]);
let nextId = 0;

export function useToast() {
	function add(options: { severity?: ToastMessage['severity']; summary: string; detail?: string; life?: number }) {
		const message: ToastMessage = {
			id: nextId++,
			severity: options.severity ?? 'info',
			summary: options.summary,
			detail: options.detail,
			life: options.life ?? 4000,
		};
		messages.push(message);
		setTimeout(() => remove(message.id), message.life);
	}

	function remove(id: number) {
		const index = messages.findIndex((m) => m.id === id);
		if (index !== -1) messages.splice(index, 1);
	}

	return { messages, add, remove };
}

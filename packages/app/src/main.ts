import './assets/main.css';

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import PrimeVue from 'primevue/config';
import Aura from '@primevue/themes/aura';

import App from './App.vue';
import router from './router';
import { VueQueryPlugin } from '@tanstack/vue-query';
import { definePreset } from '@primevue/themes';
import ToastService from 'primevue/toastservice';

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(VueQueryPlugin);

const MyPreset = definePreset(Aura, {
	semantic: {
		primary: {
			50: '{zinc.50}',
			100: '{zinc.100}',
			200: '{zinc.200}',
			300: '{zinc.300}',
			400: '{zinc.400}',
			500: '{zinc.500}',
			600: '{zinc.600}',
			700: '{zinc.700}',
			800: '{zinc.800}',
			900: '{zinc.900}',
			950: '{zinc.950}',
		},
	},
});

app.use(PrimeVue, {
	theme: {
		preset: MyPreset,
	},
});
app.use(ToastService);

app.mount('#app');

<template>
	<component
		:is="as"
		:type="as === 'button' ? 'button' : undefined"
		:class="[
			'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900',
			variantClasses[variant],
			sizeClasses[size],
			{ 'opacity-50 cursor-not-allowed': disabled || loading },
		]"
		:disabled="disabled || loading"
		v-bind="$attrs"
	>
		<svg v-if="loading" class="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
			<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
			<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
		</svg>
		<slot name="icon-left" />
		<slot />
		<slot name="icon-right" />
	</component>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
	as?: string | object;
	variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
	size?: 'sm' | 'md' | 'lg';
	disabled?: boolean;
	loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
	as: 'button',
	variant: 'primary',
	size: 'md',
	disabled: false,
	loading: false,
});

const variantClasses = {
	primary: 'bg-sky-600 hover:bg-sky-500 text-white focus:ring-sky-500 border border-transparent shadow-sm',
	secondary: 'bg-gray-700 hover:bg-gray-600 text-gray-100 focus:ring-gray-500 border border-transparent shadow-sm',
	danger: 'bg-red-600 hover:bg-red-500 text-white focus:ring-red-500 border border-transparent shadow-sm',
	ghost: 'bg-transparent hover:bg-gray-800 text-gray-300 hover:text-white focus:ring-gray-500',
	outline: 'bg-transparent border border-gray-600 text-gray-300 hover:border-gray-500 hover:text-white focus:ring-gray-500',
};

const sizeClasses = {
	sm: 'text-xs px-3 py-1.5',
	md: 'text-sm px-4 py-2',
	lg: 'text-base px-6 py-3',
};
</script>

<template>
	<div class="relative">
		<div v-if="$slots['icon-left']" class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
			<slot name="icon-left" />
		</div>
		<input
			:value="modelValue"
			@input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
			:class="[
				'p-3 block w-full rounded-lg border-gray-700 bg-gray-800 text-white placeholder-gray-400 focus:border-sky-500 focus:ring-sky-500 sm:text-sm transition-colors duration-200',
				{ 'pl-10': $slots['icon-left'], 'pr-10': clearable && modelValue },
			]"
			v-bind="$attrs"
		/>
		<div v-if="clearable && modelValue" class="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer text-gray-400 hover:text-white transition-colors" @click="$emit('update:modelValue', '')">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
			</svg>
		</div>
	</div>
</template>

<script setup lang="ts">
defineProps<{
	modelValue: string | number;
	clearable?: boolean;
}>();

defineEmits<{
	(e: 'update:modelValue', value: string | number): void;
}>();
</script>

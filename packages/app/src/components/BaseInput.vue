<template>
	<div class="relative">
		<div v-if="$slots['icon-left']" class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
			<slot name="icon-left" />
		</div>
		<input
			:value="modelValue"
			@input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
			:class="[
				'block w-full rounded-sm border border-border bg-bg text-text placeholder-muted/70 px-3 py-2 text-sm transition-colors duration-150 focus:outline-none focus:border-accent',
				{ 'pl-9': $slots['icon-left'], 'pr-9': clearable && modelValue },
			]"
			v-bind="$attrs"
		/>
		<button
			v-if="clearable && modelValue"
			type="button"
			class="absolute inset-y-0 right-0 pr-3 flex items-center text-muted hover:text-text transition-colors"
			@click="$emit('update:modelValue', '')"
			aria-label="Clear"
		>
			[x]
		</button>
	</div>
</template>

<script setup lang="ts">
defineProps<{
	modelValue: string | number | undefined;
	clearable?: boolean;
}>();

defineEmits<{
	(e: 'update:modelValue', value: string | number): void;
}>();
</script>

<template>
	<div class="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl overflow-hidden hover:border-gray-600 transition-all duration-300 hover:shadow-lg hover:shadow-sky-900/10 group">
		<div v-if="$slots.header || title" class="px-5 py-4 border-b border-gray-700/50 flex items-center justify-between">
			<slot name="header">
				<h3 class="text-lg font-medium text-white group-hover:text-sky-400 transition-colors">
					{{ title }}
				</h3>
			</slot>
			<slot name="actions" />
		</div>
		<div class="p-5">
			<slot />
		</div>
		<div v-if="$slots.footer" class="px-5 py-4 bg-gray-900/30 border-t border-gray-700/50">
			<slot name="footer" />
		</div>
	</div>
</template>

<script setup lang="ts">
defineProps<{
	title?: string;
}>();
</script>

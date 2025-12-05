<template>
	<div class="flex flex-col gap-6">
		<!-- Header / Controls -->
		<div class="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
			<div class="relative w-full sm:w-72">
				<BaseInput v-model="searchQuery" placeholder="Search..." clearable>
					<template #icon-left>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
						</svg>
					</template>
				</BaseInput>
			</div>

			<div class="flex items-center gap-2 bg-gray-800 p-1 rounded-lg border border-gray-700">
				<button @click="currentLayout = 'grid'" :class="['p-2 rounded-md transition-all duration-200', currentLayout === 'grid' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200']" title="Grid View">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
						/>
					</svg>
				</button>
				<button @click="currentLayout = 'table'" :class="['p-2 rounded-md transition-all duration-200', currentLayout === 'table' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200']" title="Table View">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
					</svg>
				</button>
			</div>
		</div>

		<!-- Content -->
		<div v-if="filteredItems.length === 0" class="text-center py-12 text-gray-500">
			<slot name="empty">
				<div class="flex flex-col items-center gap-2">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<p>No items found</p>
				</div>
			</slot>
		</div>

		<div v-else>
			<!-- Grid Layout -->
			<div v-if="currentLayout === 'grid'" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
				<div v-for="item in filteredItems" :key="item.id">
					<slot name="grid-item" :item="item" />
				</div>
			</div>

			<!-- Table Layout -->
			<div v-else class="overflow-x-auto rounded-xl border border-gray-700/50">
				<table class="w-full text-left text-sm text-gray-400">
					<thead class="bg-gray-800/50 text-xs uppercase text-gray-400">
						<tr>
							<slot name="table-header" />
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-700/50 bg-gray-800/20">
						<tr v-for="item in filteredItems" :key="item.id" class="hover:bg-gray-700/30 transition-colors">
							<slot name="table-row" :item="item" />
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts" generic="T extends { id: string | number }">
import { ref, computed } from 'vue';
import BaseInput from './BaseInput.vue';

const props = withDefaults(
	defineProps<{
		items: T[];
		filterFields?: (keyof T)[];
		defaultLayout?: 'grid' | 'table';
	}>(),
	{
		items: () => [],
		filterFields: () => [],
		defaultLayout: 'grid',
	}
);

const currentLayout = ref(props.defaultLayout);
const searchQuery = ref('');

const filteredItems = computed(() => {
	if (!searchQuery.value) return props.items;

	const query = searchQuery.value.toLowerCase();
	return props.items.filter((item) => {
		return props.filterFields.some((field) => {
			const value = item[field];
			return String(value).toLowerCase().includes(query);
		});
	});
});
</script>

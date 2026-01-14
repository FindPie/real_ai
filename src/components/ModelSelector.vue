<template>
  <div class="model-selector">
    <label for="model-select">选择模型:</label>
    <select
      id="model-select"
      :value="modelValue"
      @change="$emit('update:modelValue', $event.target.value)"
    >
      <optgroup
        v-for="(models, provider) in groupedModels"
        :key="provider"
        :label="provider"
      >
        <option
          v-for="model in models"
          :key="model.id"
          :value="model.id"
        >
          {{ model.name }}{{ getTypeLabel(model.type) }}
        </option>
      </optgroup>
    </select>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { AVAILABLE_MODELS } from '../services/api.js'

defineProps({
  modelValue: {
    type: String,
    required: true
  }
})

defineEmits(['update:modelValue'])

const groupedModels = computed(() => {
  return AVAILABLE_MODELS.reduce((groups, model) => {
    if (!groups[model.provider]) {
      groups[model.provider] = []
    }
    groups[model.provider].push(model)
    return groups
  }, {})
})

// 获取模型类型标签
const getTypeLabel = (type) => {
  const labels = {
    'vision': ' 👁️',
    'image-gen': ' 🎨',
    'reasoning': ' 🧠'
  }
  return labels[type] || ''
}
</script>

<style scoped>
.model-selector {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.model-selector label {
  font-size: 13px;
  color: #666;
  white-space: nowrap;
}

.model-selector select {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  background: white;
  cursor: pointer;
  outline: none;
  min-width: 0;
  max-width: 100%;
}

.model-selector select:focus {
  border-color: #007bff;
}

/* 移动端适配 */
@media (max-width: 480px) {
  .model-selector {
    width: 100%;
  }

  .model-selector label {
    font-size: 12px;
  }

  .model-selector select {
    font-size: 13px;
    padding: 6px 8px;
  }
}
</style>

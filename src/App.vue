<template>
  <div class="app-container">
    <header class="app-header">
      <h1>Real AI</h1>
      <p>智能对话助手</p>
    </header>
    <ChatBox />
  </div>
</template>

<script setup>
import ChatBox from './components/ChatBox.vue'
</script>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-width: 800px;
  margin: 0 auto;
  padding: 12px;
}

.app-header {
  text-align: center;
  padding: 12px 0;
  flex-shrink: 0;
}

.app-header h1 {
  color: #333;
  font-size: 1.5rem;
  margin-bottom: 4px;
}

.app-header p {
  color: #666;
  font-size: 0.8rem;
}

/* 移动端适配 */
@media (max-width: 480px) {
  .app-container {
    padding: 8px;
  }

  .app-header {
    padding: 8px 0;
  }

  .app-header h1 {
    font-size: 1.25rem;
  }

  .app-header p {
    font-size: 0.75rem;
  }
}
</style>

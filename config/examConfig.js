// config/examConfig.js
// Centralized exam configuration for all certification types

export const EXAM_CONFIGS = {
  'Salesforce Associate Certification': {
    description: 'Platform Foundations - 40 questions, 62% pass mark',
    questionCount: 40,
    passMark: 62,
    timeLimit: 90, // minutes
  },
  'Salesforce Administrator Certification': {
    description: 'Admin Certification - 60 questions, 70% pass mark',
    questionCount: 60,
    passMark: 70,
    timeLimit: 120, // minutes
  },
  'Salesforce AI Agentforce': {
    description: 'AI and Agentforce - 40 questions, 70% pass mark',
    questionCount: 40,
    passMark: 70,
    timeLimit: 90, // minutes
  }
};
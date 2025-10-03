// config/examConfig.js
// Centralized exam configuration for all certification types
// Updated with official Salesforce certification specifications

export const EXAM_CONFIGS = {
  'Salesforce Certified Platform Foundations': {
    description: 'Platform Foundations - 60 questions (+ 5 non-scored), 62% pass mark',
    questionCount: 60,  // 60 scored + 5 non-scored (system generates 60 for scoring)
    passMark: 62,
    timeLimit: 70, // minutes
    officialName: 'Salesforce Certified Associate'
  },
  'Salesforce Certified Platform Administrator': {
    description: 'Platform Administrator - 60 questions (+ 5 non-scored), 65% pass mark',
    questionCount: 60,  // 60 scored + 5 non-scored (system generates 60 for scoring)
    passMark: 65,
    timeLimit: 105, // minutes
    officialName: 'Salesforce Certified Administrator'
  },
  'Salesforce Certified Agentforce Specialist': {
    description: 'Agentforce Specialist - 60 questions (+ 5 non-scored), 73% pass mark',
    questionCount: 60,  // 60 scored + 5 non-scored (system generates 60 for scoring)
    passMark: 73,
    timeLimit: 105, // minutes
    officialName: 'Salesforce AI Agentforce Specialist'
  }
};
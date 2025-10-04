// config/examConfig.js
// Corrected exam configuration with accurate question counts

export const EXAM_CONFIGS = {
  'Salesforce Certified Platform Foundations': {
    description: 'Platform Foundations - 40 scored questions, 62% pass mark',
    questionCount: 40,  // Corrected from 60 to 40
    passMark: 62,
    timeLimit: 70, // minutes
    officialName: 'Salesforce Certified Associate',
    note: 'Official exam has 40 scored questions (+ 5 unscored pre-test items not included here)'
  },
  'Salesforce Certified Platform Administrator': {
    description: 'Platform Administrator - 60 questions (+ 5 non-scored), 65% pass mark',
    questionCount: 60,
    passMark: 65,
    timeLimit: 105, // minutes
    officialName: 'Salesforce Certified Administrator'
  },
  'Salesforce Certified Agentforce Specialist': {
    description: 'Agentforce Specialist - 60 questions (+ 5 non-scored), 73% pass mark',
    questionCount: 60,
    passMark: 73,
    timeLimit: 105, // minutes
    officialName: 'Salesforce AI Agentforce Specialist'
  }
};
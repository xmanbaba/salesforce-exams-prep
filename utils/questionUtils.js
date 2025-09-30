// utils/questionUtils.js
// Question generation with correct Gemini API model names

import { EXAM_CONFIGS } from '../config/examConfig';

// API Configuration
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
const modelName = import.meta.env.VITE_GEMINI_MODEL_NAME || "gemini-1.5-pro-latest";

// Fisher-Yates shuffle algorithm
export const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Randomize questions and shuffle options
export const randomizeQuestions = (questions) => {
  return shuffleArray(questions).map(question => {
    const shuffledOptions = shuffleArray([...question.options]);
    const correctOptionIndex = ['A', 'B', 'C', 'D'].indexOf(question.answer);
    const correctOptionText = question.options[correctOptionIndex];
    const newCorrectIndex = shuffledOptions.indexOf(correctOptionText);
    const newCorrectAnswer = ['A', 'B', 'C', 'D'][newCorrectIndex];
    
    return {
      ...question,
      options: shuffledOptions,
      answer: newCorrectAnswer
    };
  });
};

// Get certification-specific prompts
const getCertificationPrompt = (examName, count) => {
  const prompts = {
    'Salesforce Associate Certification': `You are a highly experienced Salesforce Administrator, Architect, and certification expert.

EXAM SPECIFICATIONS:
- Certification: Salesforce Certified Associate (Platform Foundations)
- Total Questions: ${count} questions
- Duration: 70 minutes
- Passing Score: 62%

DOMAIN COVERAGE (distribute questions across these domains):
1. Salesforce Ecosystem (~32% of questions = ${Math.round(count * 0.32)} questions)
   - Understanding Salesforce capabilities and products
   - Salesforce terminology and concepts
   - AppExchange and third-party integrations

2. Navigation (~28% of questions = ${Math.round(count * 0.28)} questions)
   - User interface navigation
   - Finding and using features
   - Working with records and data

3. Data Model (~25% of questions = ${Math.round(count * 0.25)} questions)
   - Standard and custom objects
   - Fields and field types
   - Relationships between objects

4. Reports & Dashboards (~15% of questions = ${Math.round(count * 0.15)} questions)
   - Creating and customizing reports
   - Dashboard components
   - Data analysis basics

QUESTION TYPE MIX:
- Multiple Choice (single correct answer): ~60%
- Scenario-Based Questions: ~40%

DIFFICULTY DISTRIBUTION:
- Easy (foundational concepts): 30%
- Medium (application of knowledge): 50%
- Hard (complex scenarios): 20%

CRITICAL REQUIREMENTS:
- Generate ${count} UNIQUE questions - NO repetition
- Each question must test different concepts
- Include realistic business scenarios
- Provide detailed explanations (3-4 sentences minimum)
- Ensure distractors are plausible but clearly incorrect`,

    'Salesforce Administrator Certification': `You are a highly experienced Salesforce Administrator, Architect, and certification expert.

EXAM SPECIFICATIONS:
- Certification: Salesforce Certified Administrator
- Total Questions: ${count} questions
- Duration: 105 minutes
- Passing Score: 70%

DOMAIN COVERAGE:
1. Configuration and Setup (~20%)
2. Object Manager and Lightning App Builder (~20%)
3. Sales and Marketing Applications (~12%)
4. Service and Support Applications (~11%)
5. Productivity and Collaboration (~7%)
6. Data and Analytics Management (~14%)
7. Workflow/Process Automation (~16%)

Generate ${count} UNIQUE questions covering all domains with realistic scenarios.`,

    'Salesforce AI Agentforce': `You are a highly experienced Salesforce AI Specialist and Agentforce expert.

EXAM SPECIFICATIONS:
- Certification: Salesforce Certified AI Specialist (Agentforce)
- Total Questions: ${count} questions
- Duration: 105 minutes
- Passing Score: 70%

DOMAIN COVERAGE:
1. Prompt Engineering (~30%)
2. Agentforce Concepts (~30%)
3. Agentforce & Data Cloud (~20%)
4. Agentforce & Service Cloud (~10%)
5. Agentforce & Sales Cloud (~10%)

Generate ${count} UNIQUE questions with focus on real-world AI scenarios.`
  };

  return prompts[examName] || prompts['Salesforce Associate Certification'];
};

// Generate questions using Gemini API
export const generateQuestions = async (examName, count) => {
  console.log(`🤖 Generating ${count} questions for ${examName} using ${modelName}...`);
  
  if (!apiKey || apiKey === "") {
    throw new Error("Gemini API key is not configured. Please add VITE_GEMINI_API_KEY to your .env file.");
  }

  const systemPrompt = getCertificationPrompt(examName, count);
  
  const fullPrompt = `${systemPrompt}

Generate exactly ${count} unique, non-repetitive practice exam questions for ${examName}.

CRITICAL: Each question must be completely different - no repeated concepts or scenarios.

Return your response as a valid JSON array ONLY. No other text, no markdown, no explanation.

Format:
[
  {
    "question": "question text here",
    "options": ["option 1 text", "option 2 text", "option 3 text", "option 4 text"],
    "answer": "A",
    "explanation": "detailed explanation here"
  }
]`;

  const payload = {
    contents: [{
      parts: [{ text: fullPrompt }]
    }],
    generationConfig: {
      temperature: 0.9,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192
    }
  };

  try {
    // Use v1beta API endpoint which supports more models
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    
    console.log(`📡 Calling Gemini API with model: ${modelName}...`);
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ API Response Error:", response.status, errorText);
      throw new Error(`Gemini API error (${response.status}). Check your API key and try again.`);
    }

    const result = await response.json();
    console.log("📦 API Response received");

    const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!jsonText) {
      throw new Error("Gemini API returned empty response.");
    }

    console.log("📄 Parsing JSON response...");
    
    // Clean the response (remove markdown code blocks if present)
    let cleanedText = jsonText.trim();
    cleanedText = cleanedText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    
    const questionsArray = JSON.parse(cleanedText);
    
    if (!Array.isArray(questionsArray) || questionsArray.length === 0) {
      throw new Error("API returned invalid format.");
    }

    // Clean up options
    const cleanedQuestions = questionsArray.map(q => ({
      ...q,
      options: q.options.map(option => 
        option.replace(/^[A-D]\.\s*/, '').trim()
      )
    }));

    console.log(`✅ Successfully generated ${cleanedQuestions.length} unique AI questions`);

    return cleanedQuestions;

  } catch (e) {
    console.error("❌ AI Generation Error:", e);
    throw new Error(`Failed to generate questions: ${e.message}`);
  }
};
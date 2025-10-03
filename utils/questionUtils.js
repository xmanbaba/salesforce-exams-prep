// utils/questionUtils.js
// Question generation with correct Gemini API model names

import { EXAM_CONFIGS } from '../config/examConfig';

// API Configuration - Using FREE Gemini 1.5 Flash Model (Stable)
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
const modelName = import.meta.env.VITE_GEMINI_MODEL_NAME || "gemini-1.5-flash";

// NOTE: gemini-2.5-flash is being retired October 30, 2025
// Using gemini-1.5-flash which is stable and not deprecated

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

QUESTION TYPE MIX (STRICT DISTRIBUTION):
- Multiple Choice (exactly 1 correct answer, 3 distractors): 30% (${Math.round(count * 0.30)} questions)
- Multiple Select (2-3 correct answers from 4-5 options): 20% (${Math.round(count * 0.20)} questions)
- True/False Questions: 10% (${Math.round(count * 0.10)} questions)
- Scenario/Case Study Questions (with context and sub-questions): 40% (${Math.round(count * 0.40)} questions)

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

// Generate questions using Gemini API with retry logic
export const generateQuestions = async (examName, count, retryCount = 0) => {
  const MAX_RETRIES = 2;
  
  console.log(`🤖 Generating ${count} questions for ${examName} using ${modelName}...`);
  
  if (!apiKey || apiKey === "") {
    throw new Error("Gemini API key is not configured. Please add VITE_GEMINI_API_KEY to your .env file.");
  }

  const systemPrompt = getCertificationPrompt(examName, count);
  
  const fullPrompt = `${systemPrompt}

Generate exactly ${count} unique, non-repetitive practice exam questions for ${examName}.

CRITICAL: Each question must be completely different - no repeated concepts or scenarios.

Return your response as a valid JSON array ONLY. No other text, no markdown, no explanation, no code fences.

CRITICAL JSON FORMATTING RULES:
- Use double quotes for all strings
- Escape any quotes inside strings with \"
- Do not include trailing commas
- Ensure proper bracket closure
- No comments in JSON

Format:
[
  {
    "questionType": "multiple-choice" or "true-false" or "scenario",
    "question": "question text here",
    "options": ["option 1 text", "option 2 text", "option 3 text", "option 4 text"],
    "answer": "A" (or "True"/"False" for true-false questions),
    "explanation": "detailed explanation here"
  }
]

For True/False questions, use this format:
{
  "questionType": "true-false",
  "question": "statement to evaluate",
  "options": ["True", "False"],
  "answer": "True" or "False",
  "explanation": "why this is true or false"
}

CRITICAL TRUE/FALSE GUIDELINES:
- Statements must be clear and unambiguous
- Avoid double negatives or confusing phrasing
- Ensure the explanation validates the correct answer without contradictions
- Use proper Salesforce terminology (e.g., "standard objects" not "custom standard objects")
- Test your logic: if answer is True, explanation should clearly explain why it's true`;

  const payload = {
    contents: [{
      parts: [{ text: fullPrompt }]
    }],
    generationConfig: {
      temperature: 0.7,  // Reduced for more consistent JSON
      topP: 0.9,
      topK: 40,
      maxOutputTokens: 8192
    }
  };

  try {
    // Use v1beta API endpoint - this works with all Gemini models
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
    
    // Enhanced JSON cleaning and extraction
    let cleanedText = jsonText.trim();
    
    // Remove markdown code fences
    cleanedText = cleanedText.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
    
    // Extract JSON array between first [ and last ]
    const firstBracket = cleanedText.indexOf('[');
    const lastBracket = cleanedText.lastIndexOf(']');
    
    if (firstBracket === -1 || lastBracket === -1 || lastBracket <= firstBracket) {
      console.error("❌ No valid JSON array found in response");
      throw new Error("Response does not contain a valid JSON array");
    }
    
    cleanedText = cleanedText.slice(firstBracket, lastBracket + 1);
    
    // Fix common JSON issues
    cleanedText = cleanedText
      .replace(/,(\s*[}\]])/g, '$1')  // Remove trailing commas
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '');  // Remove control characters
    
    let questionsArray;
    try {
      questionsArray = JSON.parse(cleanedText);
    } catch (parseErr) {
      console.error("❌ JSON Parse Error:", parseErr.message);
      console.error("First 500 chars of cleaned text:", cleanedText.substring(0, 500));
      console.error("Last 500 chars of cleaned text:", cleanedText.substring(cleanedText.length - 500));
      throw new Error(`JSON parsing failed: ${parseErr.message}. The AI response may be malformed.`);
    }
    
    if (!Array.isArray(questionsArray) || questionsArray.length === 0) {
      throw new Error("API returned invalid format.");
    }

    // Normalize question format and clean options
    const cleanedQuestions = questionsArray.map((q, idx) => {
      // Handle both array and non-array options
      let opts = [];
      let normalizedAnswer = q.answer || 'A';
      
      if (q.questionType === 'true-false') {
        opts = ['True', 'False'];
        // CRITICAL FIX: Normalize True/False answers to option letters
        // This ensures scoring works correctly
        if (normalizedAnswer === 'True' || normalizedAnswer === 'true') {
          normalizedAnswer = 'A';  // True is always option A
        } else if (normalizedAnswer === 'False' || normalizedAnswer === 'false') {
          normalizedAnswer = 'B';  // False is always option B
        }
      } else if (Array.isArray(q.options)) {
        opts = q.options.map(option =>
          option ? option.replace(/^[A-D]\.\s*/, '').trim() : ''
        );
      } else {
        console.warn(`Question ${idx + 1} has invalid options format, using defaults`);
        opts = ['Option A', 'Option B', 'Option C', 'Option D'];
      }
      
      return {
        questionType: q.questionType || 'multiple-choice',
        question: q.question || '',
        options: opts,
        answer: normalizedAnswer,  // Now always A/B/C/D format
        explanation: q.explanation || '',
        originalAnswer: q.answer  // Keep original for reference
      };
    });

    console.log(`✅ Successfully generated ${cleanedQuestions.length} unique AI questions`);
    
    // CRITICAL: Enforce exact question count
    if (cleanedQuestions.length !== count) {
      console.warn(`⚠️ Question count mismatch: Expected ${count}, got ${cleanedQuestions.length}`);
      
      if (cleanedQuestions.length > count) {
        // Trim excess questions
        console.log(`✂️ Trimming ${cleanedQuestions.length - count} excess questions`);
        return cleanedQuestions.slice(0, count);
      } else if (cleanedQuestions.length < count && retryCount < MAX_RETRIES) {
        // Too few questions - retry
        console.log(`🔄 Too few questions. Retrying to get exactly ${count} questions...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return generateQuestions(examName, count, retryCount + 1);
      }
    }

    return cleanedQuestions;

  } catch (e) {
    console.error("❌ AI Generation Error:", e);
    
    // Retry logic for transient failures
    if (retryCount < MAX_RETRIES && e.message.includes('JSON')) {
      console.log(`🔄 Retrying... Attempt ${retryCount + 1} of ${MAX_RETRIES}`);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      return generateQuestions(examName, count, retryCount + 1);
    }
    
    throw new Error(`Failed to generate questions: ${e.message}`);
  }
};
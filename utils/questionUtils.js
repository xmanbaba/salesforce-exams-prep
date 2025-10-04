// utils/questionUtils.js
// Complete version with batch processing for reliable question generation

import { EXAM_CONFIGS } from '../config/examConfig';

// API Configuration
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
// IMPORTANT: Use the model that YOUR API key supports
const modelName = import.meta.env.VITE_GEMINI_MODEL_NAME || "gemini-2.5-flash";

// CRITICAL: Gemini struggles with 60 questions at once - use batch processing
const MAX_BATCH_SIZE = 15; // Reduced from 20 to 15 for better reliability

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
    'Salesforce Certified Platform Foundations': `You are a Salesforce certification expert creating practice exam questions.

EXAM SPECIFICATIONS:
- Certification: Salesforce Certified Platform Foundations (Associate)
- Total Questions: ${count} questions
- Duration: 70 minutes
- Passing Score: 62%

DOMAIN COVERAGE (distribute questions proportionally):
1. Salesforce Ecosystem (~32% = ${Math.round(count * 0.32)} questions)
   - Understanding Salesforce capabilities and products
   - Salesforce terminology and concepts
   - AppExchange and third-party integrations

2. Navigation (~28% = ${Math.round(count * 0.28)} questions)
   - User interface navigation
   - Finding and using features
   - Working with records and data

3. Data Model (~25% = ${Math.round(count * 0.25)} questions)
   - Standard and custom objects
   - Fields and field types
   - Relationships between objects

4. Reports & Dashboards (~15% = ${Math.round(count * 0.15)} questions)
   - Creating and customizing reports
   - Dashboard components
   - Data analysis basics

QUESTION DIFFICULTY:
- Easy (foundational concepts): 30%
- Medium (application of knowledge): 50%
- Hard (complex scenarios): 20%

CRITICAL: Generate ${count} UNIQUE questions with NO repetition.`,

    'Salesforce Certified Platform Administrator': `You are a Salesforce Administrator certification expert.

EXAM SPECIFICATIONS:
- Certification: Salesforce Certified Platform Administrator
- Total Questions: ${count} questions
- Duration: 105 minutes
- Passing Score: 65%

DOMAIN COVERAGE:
1. Configuration and Setup (~20%)
2. Object Manager and Lightning App Builder (~20%)
3. Sales and Marketing Applications (~12%)
4. Service and Support Applications (~11%)
5. Productivity and Collaboration (~7%)
6. Data and Analytics Management (~14%)
7. Workflow/Process Automation (~16%)

CRITICAL: Generate ${count} UNIQUE questions covering all domains with realistic scenarios.`,

    'Salesforce Certified Agentforce Specialist': `You are a Salesforce AI and Agentforce certification expert.

EXAM SPECIFICATIONS:
- Certification: Salesforce Certified Agentforce Specialist
- Total Questions: ${count} questions
- Duration: 105 minutes
- Passing Score: 73%

DOMAIN COVERAGE:
1. Prompt Engineering (~30%)
2. Agentforce Concepts (~30%)
3. Agentforce & Data Cloud (~20%)
4. Agentforce & Service Cloud (~10%)
5. Agentforce & Sales Cloud (~10%)

CRITICAL: Generate ${count} UNIQUE questions with focus on real-world AI scenarios.`
  };

  return prompts[examName] || prompts['Salesforce Certified Platform Foundations'];
};

// Advanced JSON repair function
const repairJSON = (text) => {
  console.log("🔧 Attempting to repair JSON...");
  
  let repaired = text;
  
  // Fix missing commas between objects
  repaired = repaired.replace(/\}(\s+)\{/g, '},$1{');
  
  // Fix missing commas between properties
  repaired = repaired.replace(/\}(\s+)"([a-zA-Z])/g, '},$1"$2');
  
  // Fix missing commas after closing arrays before next property
  repaired = repaired.replace(/\](\s+)"([a-zA-Z])/g, '],$1"$2');
  
  // Fix missing commas after values before next property
  repaired = repaired.replace(/"(\s+)"([a-zA-Z]+)":/g, '",$1"$2":');
  
  // Fix missing commas in arrays
  repaired = repaired.replace(/"(\s+)"/g, '",$1"');
  
  // Remove duplicate commas
  repaired = repaired.replace(/,+/g, ',');
  
  // Fix comma before closing brackets
  repaired = repaired.replace(/,(\s*[\]}])/g, '$1');
  
  return repaired;
};

// Enhanced JSON cleaning and extraction
const cleanAndExtractJSON = (text) => {
  if (!text) {
    throw new Error("Empty response from API");
  }

  console.log("🧹 Cleaning JSON response...");
  
  // Remove markdown code fences
  let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  
  // Find the JSON array boundaries
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');
  
  if (firstBracket === -1 || lastBracket === -1 || lastBracket <= firstBracket) {
    console.error("❌ No valid JSON array found");
    throw new Error("Response does not contain a valid JSON array");
  }
  
  // Extract only the array
  cleaned = cleaned.slice(firstBracket, lastBracket + 1);
  
  // Apply JSON repairs
  cleaned = repairJSON(cleaned);
  
  // Remove control characters
  cleaned = cleaned.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
  
  // Fix escaped quotes issues
  cleaned = cleaned
    .replace(/\\\\"/g, '"')  // Fix double-escaped quotes
    .replace(/\\'/g, "'");   // Fix escaped single quotes
  
  // Final check: ensure balanced brackets
  const openBrackets = (cleaned.match(/\{/g) || []).length;
  const closeBrackets = (cleaned.match(/\}/g) || []).length;
  
  if (openBrackets !== closeBrackets) {
    console.warn(`⚠️ Unbalanced brackets detected: ${openBrackets} open, ${closeBrackets} close`);
    
    // Try to fix by removing incomplete last object
    if (openBrackets > closeBrackets) {
      const lastCompleteObject = cleaned.lastIndexOf('},');
      if (lastCompleteObject > 0) {
        cleaned = cleaned.substring(0, lastCompleteObject + 1) + ']';
        console.log("🔧 Removed incomplete last object");
      }
    }
  }

  return cleaned;
};

// Normalize question format
const normalizeQuestion = (q, index) => {
  if (!q.question || !q.options || !q.answer || !q.explanation) {
    console.warn(`⚠️ Question ${index + 1} has missing required fields, skipping`);
    return null;
  }

  let opts = [];
  let normalizedAnswer = q.answer.trim().toUpperCase();

  // Handle true/false questions
  if (q.questionType === 'true-false') {
    opts = ['True', 'False'];
    
    // Normalize answer to A/B format
    const answerLower = normalizedAnswer.toLowerCase();
    if (answerLower === 'true' || answerLower === 'a') {
      normalizedAnswer = 'A';
    } else if (answerLower === 'false' || answerLower === 'b') {
      normalizedAnswer = 'B';
    }
  } 
  // Handle regular multiple choice
  else if (Array.isArray(q.options)) {
    // Clean options - remove letter prefixes and trim
    opts = q.options.map(option => {
      if (typeof option !== 'string') return '';
      return option.replace(/^[A-D][\.\)]\s*/i, '').trim();
    });
    
    // Filter out empty options
    opts = opts.filter(opt => opt.length > 0);
    
    // Ensure we have at least 2 options
    if (opts.length < 2) {
      console.warn(`⚠️ Question ${index + 1} has only ${opts.length} options, skipping`);
      return null;
    }
    
    // Pad to 4 options if needed for multiple choice
    while (opts.length < 4 && q.questionType === 'multiple-choice') {
      opts.push(`Option ${String.fromCharCode(65 + opts.length)}`);
    }
  } else {
    console.warn(`⚠️ Question ${index + 1} has invalid options format`);
    return null;
  }

  // Normalize answer format
  if (q.questionType === 'true-false') {
    if (!['A', 'B'].includes(normalizedAnswer)) {
      normalizedAnswer = 'A'; // Default to True
    }
  } else {
    // For multiple choice, ensure answer is valid
    const validAnswers = ['A', 'B', 'C', 'D'].slice(0, opts.length);
    if (!validAnswers.includes(normalizedAnswer)) {
      console.warn(`⚠️ Question ${index + 1} has invalid answer "${normalizedAnswer}", defaulting to A`);
      normalizedAnswer = 'A';
    }
  }

  return {
    questionType: q.questionType || 'multiple-choice',
    question: q.question.trim(),
    options: opts,
    answer: normalizedAnswer,
    explanation: q.explanation.trim(),
    originalAnswer: q.answer
  };
};

// Generate a single batch of questions
const generateBatch = async (examName, batchSize, batchNumber) => {
  console.log(`📦 Generating batch ${batchNumber}: ${batchSize} questions...`);
  
  const systemPrompt = getCertificationPrompt(examName, batchSize);
  
  const fullPrompt = `${systemPrompt}

CRITICAL: Return ONLY valid JSON array. No markdown, no explanation, no code fences.

FORMAT (exactly ${batchSize} unique questions):
[
  {
    "questionType": "multiple-choice",
    "question": "Question text here?",
    "options": [
      "First option text without letter prefix",
      "Second option text without letter prefix",
      "Third option text without letter prefix",
      "Fourth option text without letter prefix"
    ],
    "answer": "A",
    "explanation": "Detailed explanation text."
  }
]

STRICT RULES:
1. NO letter prefixes in options (no "A.", "B.", etc. - just plain text)
2. Answer must be single letter: "A", "B", "C", or "D"
3. All strings must be in double quotes
4. Use commas between all array items and object properties
5. NO trailing commas before ] or }
6. Escape any quotes inside strings with backslash
7. Each question must have ALL required fields

For True/False questions use this format:
{
  "questionType": "true-false",
  "question": "Statement to evaluate?",
  "options": ["True", "False"],
  "answer": "True",
  "explanation": "Explanation of why this is true or false."
}

IMPORTANT: Generate exactly ${batchSize} complete, unique questions. Each question must be different.`;

  const payload = {
    contents: [{ parts: [{ text: fullPrompt }] }],
    generationConfig: {
      temperature: 0.5,  // Lower temperature for more consistent JSON
      topP: 0.85,
      topK: 30,
      maxOutputTokens: 3072,  // Reduced token limit for smaller, more reliable responses
      candidateCount: 1
    }
  };

  // Use v1beta API - this is the correct endpoint
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ Batch ${batchNumber} API error:`, response.status);
    throw new Error(`API error (${response.status}): ${errorText.substring(0, 200)}`);
  }

  const result = await response.json();
  const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!jsonText) {
    throw new Error("Empty API response");
  }

  const cleaned = cleanAndExtractJSON(jsonText);
  const parsed = JSON.parse(cleaned);
  
  if (!Array.isArray(parsed)) {
    throw new Error("Invalid response format - expected array");
  }

  const normalized = parsed.map((q, i) => normalizeQuestion(q, i)).filter(q => q !== null);
  
  console.log(`✅ Batch ${batchNumber}: Generated ${normalized.length}/${batchSize} valid questions`);
  
  return normalized;
};

// Main generation function with batch processing
export const generateQuestions = async (examName, totalCount, retryCount = 0) => {
  const MAX_RETRIES = 3;
  
  console.log(`🤖 Generating ${totalCount} questions for ${examName} using ${modelName}...`);
  console.log(`📊 Using batch processing with max ${MAX_BATCH_SIZE} questions per batch`);
  
  if (!apiKey || apiKey === "") {
    throw new Error("Gemini API key is not configured. Please add VITE_GEMINI_API_KEY to your .env file.");
  }

  try {
    let allQuestions = [];
    
    // Calculate number of batches needed
    const numBatches = Math.ceil(totalCount / MAX_BATCH_SIZE);
    
    console.log(`📊 Will generate ${numBatches} batches to reach ${totalCount} questions`);
    
    // Generate questions in batches
    for (let i = 0; i < numBatches; i++) {
      const remainingQuestions = totalCount - allQuestions.length;
      const batchSize = Math.min(MAX_BATCH_SIZE, remainingQuestions);
      
      try {
        const batchQuestions = await generateBatch(examName, batchSize, i + 1);
        allQuestions = allQuestions.concat(batchQuestions);
        
        console.log(`📈 Progress: ${allQuestions.length}/${totalCount} questions generated`);
        
        // Small delay between batches to avoid rate limits
        if (i < numBatches - 1 && allQuestions.length < totalCount) {
          console.log('⏳ Waiting 2 seconds before next batch...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
      } catch (batchError) {
        console.error(`❌ Batch ${i + 1} failed:`, batchError.message);
        
        // CRITICAL: Stop infinite retry on 404 errors (model not found)
        if (batchError.message.includes('404') || batchError.message.includes('not found')) {
          console.error('💥 CRITICAL: Model not found. Check your .env file has the correct model name.');
          throw new Error(`Model "${modelName}" not found. Please check VITE_GEMINI_MODEL_NAME in your .env file. Your API key may only support specific models like gemini-2.5-flash or gemini-pro.`);
        }
        
        // Retry this specific batch once (only for non-404 errors)
        if (retryCount === 0) {
          console.log(`🔄 Retrying batch ${i + 1}...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
          i--; // Retry this batch
          continue;
        } else {
          console.warn(`⚠️ Skipping failed batch ${i + 1}, continuing with next batch`);
        }
      }
      
      // Safety check: if we have enough questions, stop early
      if (allQuestions.length >= totalCount) {
        console.log(`✅ Reached target of ${totalCount} questions early`);
        break;
      }
    }

    // Validate final count
    if (allQuestions.length === 0) {
      throw new Error("No questions were generated. Please check your API key and try again.");
    }

    // Check if we got at least 80% of requested questions (lowered from 90%)
    if (allQuestions.length < totalCount * 0.8) {
      if (retryCount < MAX_RETRIES) {
        console.log(`⚠️ Only ${allQuestions.length}/${totalCount} generated. Retrying entire process...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        return generateQuestions(examName, totalCount, retryCount + 1);
      }
      
      console.warn(`⚠️ Generated ${allQuestions.length}/${totalCount} questions after ${MAX_RETRIES} attempts`);
      throw new Error(`Could only generate ${allQuestions.length} questions after multiple attempts. Please try again or use a different model.`);
    }

    // Trim to exact count if we have more
    if (allQuestions.length > totalCount) {
      console.log(`✂️ Trimming from ${allQuestions.length} to exactly ${totalCount} questions`);
      allQuestions = allQuestions.slice(0, totalCount);
    }

    if (allQuestions.length < totalCount) {
      console.warn(`⚠️ Generated ${allQuestions.length}/${totalCount} questions (${Math.round(allQuestions.length/totalCount*100)}% - acceptable)`);
    }

    console.log(`✅ Successfully generated ${allQuestions.length} questions for ${examName}`);
    return allQuestions;

  } catch (error) {
    console.error("❌ Question generation failed:", error);
    
    // Retry logic for complete failures
    if (retryCount < MAX_RETRIES && 
        (error.message.includes('JSON') || 
         error.message.includes('parse') || 
         error.message.includes('malformed') ||
         error.message.includes('Empty'))) {
      console.log(`🔄 Retrying entire generation... Attempt ${retryCount + 1}/${MAX_RETRIES}`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      return generateQuestions(examName, totalCount, retryCount + 1);
    }
    
    throw error;
  }
};
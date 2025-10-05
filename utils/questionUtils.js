// utils/questionUtils.js
// COMPLETE VERSION: Question accumulator + Multi-LLM fallback + All original features

import { EXAM_CONFIGS } from '../config/examConfig';

// ============================================================================
// API CONFIGURATION - Multi-LLM Support
// ============================================================================

const LLM_CONFIGS = {
  gemini: {
    apiKey: import.meta.env.VITE_GEMINI_API_KEY || "",
    modelName: import.meta.env.VITE_GEMINI_MODEL_NAME || "gemini-2.5-flash",
    endpoint: (modelName, apiKey) => 
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
    buildPayload: (prompt) => ({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.5,
        topP: 0.85,
        topK: 30,
        maxOutputTokens: 3072,
        candidateCount: 1
      }
    }),
    extractText: (result) => result.candidates?.[0]?.content?.parts?.[0]?.text
  },
  deepseek: {
    apiKey: import.meta.env.VITE_DEEPSEEK_API_KEY || "",
    modelName: import.meta.env.VITE_DEEPSEEK_MODEL_NAME || "deepseek/deepseek-r1",
    endpoint: () => "https://openrouter.ai/api/v1/chat/completions", // ← CHANGED TO OPENROUTER
    buildPayload: (prompt) => ({
      model: "deepseek/deepseek-r1", // ← CHANGED TO OPENROUTER MODEL FORMAT
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      max_tokens: 3072
    }),
    extractText: (result) => result.choices?.[0]?.message?.content,
    headers: (apiKey) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://yourapp.com', // ← ADDED FOR OPENROUTER
      'X-Title': 'Exam Prep App' // ← ADDED FOR OPENROUTER
    })
  },
  moonshot: {
    apiKey: import.meta.env.VITE_MOONSHOT_API_KEY || "",
    modelName: import.meta.env.VITE_MOONSHOT_MODEL || "moonshot-v1-8k",
    endpoint: () => "https://api.moonshot.cn/v1/chat/completions",
    buildPayload: (prompt) => ({
      model: import.meta.env.VITE_MOONSHOT_MODEL || "moonshot-v1-8k",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      max_tokens: 3072
    }),
    extractText: (result) => result.choices?.[0]?.message?.content,
    headers: (apiKey) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    })
  }
};

const MAX_BATCH_SIZE = 12; // Optimized batch size for reliability
let questionAccumulator = []; // Persists across retries

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

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

// ============================================================================
// CERTIFICATION-SPECIFIC PROMPTS (PRESERVED FROM ORIGINAL)
// ============================================================================

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

// ============================================================================
// JSON PROCESSING (PRESERVED FROM ORIGINAL)
// ============================================================================

const repairJSON = (text) => {
  console.log("🔧 Attempting to repair JSON...");
  
  let repaired = text;
  repaired = repaired.replace(/\}(\s+)\{/g, '},$1{');
  repaired = repaired.replace(/\}(\s+)"([a-zA-Z])/g, '},$1"$2');
  repaired = repaired.replace(/\](\s+)"([a-zA-Z])/g, '],$1"$2');
  repaired = repaired.replace(/"(\s+)"([a-zA-Z]+)":/g, '",$1"$2":');
  repaired = repaired.replace(/"(\s+)"/g, '",$1"');
  repaired = repaired.replace(/,+/g, ',');
  repaired = repaired.replace(/,(\s*[\]}])/g, '$1');
  
  return repaired;
};

const cleanAndExtractJSON = (text) => {
  if (!text) {
    throw new Error("Empty response from API");
  }

  console.log("🧹 Cleaning JSON response...");
  
  let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');
  
  if (firstBracket === -1 || lastBracket === -1 || lastBracket <= firstBracket) {
    console.error("❌ No valid JSON array found");
    throw new Error("Response does not contain a valid JSON array");
  }
  
  cleaned = cleaned.slice(firstBracket, lastBracket + 1);
  cleaned = repairJSON(cleaned);
  cleaned = cleaned.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
  cleaned = cleaned
    .replace(/\\\\"/g, '"')
    .replace(/\\'/g, "'");
  
  const openBrackets = (cleaned.match(/\{/g) || []).length;
  const closeBrackets = (cleaned.match(/\}/g) || []).length;
  
  if (openBrackets > closeBrackets) {
    const lastCompleteObject = cleaned.lastIndexOf('},');
    if (lastCompleteObject > 0) {
      cleaned = cleaned.substring(0, lastCompleteObject + 1) + ']';
      console.log("🔧 Removed incomplete last object");
    }
  }

  return cleaned;
};

const normalizeQuestion = (q, index) => {
  if (!q.question || !q.options || !q.answer || !q.explanation) {
    console.warn(`⚠️ Question ${index + 1} has missing required fields, skipping`);
    return null;
  }

  let opts = [];
  let normalizedAnswer = q.answer.trim().toUpperCase();

  if (q.questionType === 'true-false') {
    opts = ['True', 'False'];
    const answerLower = normalizedAnswer.toLowerCase();
    if (answerLower === 'true' || answerLower === 'a') {
      normalizedAnswer = 'A';
    } else if (answerLower === 'false' || answerLower === 'b') {
      normalizedAnswer = 'B';
    }
  } else if (Array.isArray(q.options)) {
    opts = q.options.map(option => {
      if (typeof option !== 'string') return '';
      return option.replace(/^[A-D][\.\)]\s*/i, '').trim();
    });
    
    opts = opts.filter(opt => opt.length > 0);
    
    if (opts.length < 2) {
      console.warn(`⚠️ Question ${index + 1} has only ${opts.length} options, skipping`);
      return null;
    }
    
    while (opts.length < 4 && q.questionType === 'multiple-choice') {
      opts.push(`Option ${String.fromCharCode(65 + opts.length)}`);
    }
  } else {
    console.warn(`⚠️ Question ${index + 1} has invalid options format`);
    return null;
  }

  if (q.questionType === 'true-false') {
    if (!['A', 'B'].includes(normalizedAnswer)) {
      normalizedAnswer = 'A';
    }
  } else {
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

// ============================================================================
// MULTI-LLM BATCH GENERATION
// ============================================================================

const generateBatchWithLLM = async (llmName, examName, batchSize, batchNumber, attemptNumber) => {
  const llm = LLM_CONFIGS[llmName];
  
  if (!llm.apiKey) {
    console.warn(`⚠️ ${llmName} API key not configured, skipping`);
    return null;
  }

  console.log(`📦 [${llmName.toUpperCase()}] Attempt ${attemptNumber}, Batch ${batchNumber}: Requesting ${batchSize} questions...`);

  const systemPrompt = getCertificationPrompt(examName, batchSize);
  
  const fullPrompt = `${systemPrompt}

CRITICAL: Return ONLY valid JSON array. No markdown, no text, no code fences.

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
1. NO letter prefixes in options (no "A.", "B.", etc.)
2. Answer must be single letter: "A", "B", "C", or "D"
3. All strings in double quotes
4. Use commas between all items and properties
5. NO trailing commas before ] or }
6. Escape quotes inside strings with backslash
7. Each question must have ALL required fields
8. Generate exactly ${batchSize} complete, unique questions

For True/False questions:
{
  "questionType": "true-false",
  "question": "Statement to evaluate?",
  "options": ["True", "False"],
  "answer": "True",
  "explanation": "Explanation text."
}`;

  const payload = llm.buildPayload(fullPrompt);
  const headers = llm.headers ? llm.headers(llm.apiKey) : { 'Content-Type': 'application/json' };

  try {
    const response = await fetch(llm.endpoint(llm.modelName, llm.apiKey), {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [${llmName.toUpperCase()}] API error:`, response.status);
      
      // Check for fatal errors
      if (response.status === 404 || errorText.includes('not found')) {
        throw new Error(`Model "${llm.modelName}" not found. Check VITE_${llmName.toUpperCase()}_MODEL_NAME in .env`);
      }
      
      throw new Error(`API error (${response.status}): ${errorText.substring(0, 200)}`);
    }

    const result = await response.json();
    const jsonText = llm.extractText(result);

    if (!jsonText) {
      throw new Error("Empty API response");
    }

    const cleaned = cleanAndExtractJSON(jsonText);
    const parsed = JSON.parse(cleaned);

    if (!Array.isArray(parsed)) {
      throw new Error("Invalid response format - expected array");
    }

    const normalized = parsed.map((q, i) => normalizeQuestion(q, i)).filter(q => q !== null);

    console.log(`✅ [${llmName.toUpperCase()}] Attempt ${attemptNumber}, Batch ${batchNumber}: Got ${normalized.length}/${batchSize} valid questions`);

    return normalized;

  } catch (error) {
    console.error(`❌ [${llmName.toUpperCase()}] Batch generation failed:`, error.message);
    throw error;
  }
};

// ============================================================================
// MAIN GENERATION FUNCTION WITH ACCUMULATOR
// ============================================================================

export const generateQuestions = async (examName, totalCount) => {
  console.log(`\n🚀 Starting question generation for ${examName}`);
  console.log(`🎯 Target: ${totalCount} questions`);
  console.log(`📊 Using batch size: ${MAX_BATCH_SIZE}`);
  console.log(`🔄 Multi-LLM fallback: Gemini → DeepSeek → Moonshot\n`);

  // Reset accumulator for new exam generation
  questionAccumulator = [];

  const MAX_ATTEMPTS = 5;
  const LLM_PRIORITY = ['gemini', 'deepseek', 'moonshot'];
  
  let attemptNumber = 0;

  while (attemptNumber < MAX_ATTEMPTS && questionAccumulator.length < totalCount) {
    attemptNumber++;
    
    const stillNeeded = totalCount - questionAccumulator.length;
    console.log(`\n🔄 ATTEMPT ${attemptNumber}/${MAX_ATTEMPTS}`);
    console.log(`📊 Current: ${questionAccumulator.length}/${totalCount} | Still need: ${stillNeeded}`);

    const numBatches = Math.ceil(stillNeeded / MAX_BATCH_SIZE);
    console.log(`📦 Will generate ${numBatches} batches`);

    for (let i = 0; i < numBatches; i++) {
      const remaining = totalCount - questionAccumulator.length;
      
      if (remaining <= 0) {
        console.log(`✅ Target reached! Have ${questionAccumulator.length} questions`);
        break;
      }

      const batchSize = Math.min(MAX_BATCH_SIZE, remaining);
      let batchQuestions = null;

      // Try each LLM in priority order
      for (const llmName of LLM_PRIORITY) {
        try {
          batchQuestions = await generateBatchWithLLM(llmName, examName, batchSize, i + 1, attemptNumber);
          
          if (batchQuestions && batchQuestions.length > 0) {
            break; // Success! Stop trying other LLMs
          }
        } catch (error) {
          console.warn(`⚠️ ${llmName} failed, trying next LLM...`);
          
          // Fatal error - stop completely
          if (error.message.includes('not found') || error.message.includes('404')) {
            console.error(`💥 CRITICAL: ${error.message}`);
            throw error;
          }
          
          // Continue to next LLM
          continue;
        }
      }

      // If all LLMs failed for this batch
      if (!batchQuestions || batchQuestions.length === 0) {
        console.error(`❌ All LLMs failed for batch ${i + 1}`);
        
        if (i < numBatches - 1) {
          console.log(`⏭️ Skipping failed batch, continuing...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        continue;
      }

      // Add to accumulator (deduplicate)
      const newQuestions = batchQuestions.filter(newQ =>
        !questionAccumulator.some(existingQ => existingQ.question === newQ.question)
      );

      questionAccumulator = questionAccumulator.concat(newQuestions);

      console.log(`📈 Accumulator: ${questionAccumulator.length}/${totalCount} total questions`);

      // Small delay between batches
      if (i < numBatches - 1 && questionAccumulator.length < totalCount) {
        console.log('⏳ Waiting 2 seconds...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Check if we've reached target
      if (questionAccumulator.length >= totalCount) {
        console.log(`🎉 Target reached at ${questionAccumulator.length} questions!`);
        break;
      }
    }

    // Exit early if we have enough
    if (questionAccumulator.length >= totalCount) {
      break;
    }

    // Delay before next attempt
    if (attemptNumber < MAX_ATTEMPTS && questionAccumulator.length < totalCount) {
      console.log(`\n⏳ Waiting 3 seconds before next attempt...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  // Final validation
  if (questionAccumulator.length === 0) {
    throw new Error("Failed to generate any questions. Please check your API keys and try again.");
  }

  // Return exactly what we have (or trim if over)
  const finalQuestions = questionAccumulator.slice(0, totalCount);

  console.log(`\n✅ GENERATION COMPLETE`);
  console.log(`📊 Generated: ${finalQuestions.length}/${totalCount} questions`);
  console.log(`🔄 Total attempts: ${attemptNumber}`);
  console.log(`💰 Efficiency: ${(finalQuestions.length / attemptNumber).toFixed(1)} questions per attempt average\n`);

  if (finalQuestions.length < totalCount) {
    const percentage = Math.round((finalQuestions.length / totalCount) * 100);
    console.warn(`⚠️ Generated ${finalQuestions.length}/${totalCount} questions (${percentage}%)`);
    
    // If we got less than 80%, throw error
    if (percentage < 80) {
      throw new Error(`Only generated ${finalQuestions.length}/${totalCount} questions (${percentage}%). Please try again.`);
    }
  }

  return finalQuestions;
};
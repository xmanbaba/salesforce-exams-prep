// utils/questionUtils.js
// FINAL VERSION: Together.ai Llama 3.1 70B (primary) + 20s timeout + Gemini 2.0 + DeepSeek fallback

import { EXAM_CONFIGS } from '../config/examConfig';

// ============================================================================
// API CONFIGURATION - Together.ai Primary
// ============================================================================

const LLM_CONFIGS = {
  together: {
    apiKey: import.meta.env.VITE_TOGETHER_API_KEY || "",
    modelName: import.meta.env.VITE_TOGETHER_MODEL || "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
    endpoint: () => "https://api.together.xyz/v1/chat/completions",
    buildPayload: (prompt) => ({
      model: import.meta.env.VITE_TOGETHER_MODEL || "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      max_tokens: 3072
    }),
    extractText: (result) => result.choices?.[0]?.message?.content,
    headers: (apiKey) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    })
  },
  gemini: {
    apiKey: import.meta.env.VITE_GEMINI_API_KEY || "",
    modelName: "gemini-2.0-flash-exp",
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
    modelName: "deepseek/deepseek-r1",
    endpoint: () => "https://openrouter.ai/api/v1/chat/completions",
    buildPayload: (prompt) => ({
      model: "deepseek/deepseek-r1",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      max_tokens: 3072
    }),
    extractText: (result) => result.choices?.[0]?.message?.content,
    headers: (apiKey) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.origin || 'https://yourapp.com',
      'X-Title': 'Salesforce Exam Prep App'
    })
  }
};

const MAX_BATCH_SIZE = 12;
const API_TIMEOUT_MS = 20000; // 20 seconds timeout
let questionAccumulator = [];

// ============================================================================
// TIMER TRACKING
// ============================================================================

let generationStartTime = null;

const startGenerationTimer = () => {
  generationStartTime = Date.now();
  console.log(`⏱️ TIMER STARTED: ${new Date(generationStartTime).toLocaleTimeString()}`);
};

const getElapsedTime = () => {
  if (!generationStartTime) return 0;
  return Math.floor((Date.now() - generationStartTime) / 1000);
};

const logElapsedTime = (label = "Elapsed") => {
  const elapsed = getElapsedTime();
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  console.log(`⏱️ ${label}: ${minutes}m ${seconds}s (${elapsed}s total)`);
};

// ============================================================================
// TIMEOUT WRAPPER FOR API CALLS
// ============================================================================

const fetchWithTimeout = async (url, options, timeoutMs = API_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs / 1000}s`);
    }
    throw error;
  }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

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
// CERTIFICATION-SPECIFIC PROMPTS
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
// JSON PROCESSING
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
// MULTI-LLM BATCH GENERATION WITH TIMEOUT
// ============================================================================

const generateBatchWithLLM = async (llmName, examName, batchSize, batchNumber, attemptNumber) => {
  const llm = LLM_CONFIGS[llmName];
  
  if (!llm.apiKey) {
    console.warn(`⚠️ ${llmName.toUpperCase()} API key not configured, skipping`);
    return null;
  }

  const batchStartTime = Date.now();
  console.log(`📦 [${llmName.toUpperCase()}] Attempt ${attemptNumber}, Batch ${batchNumber}: Requesting ${batchSize} questions...`);
  logElapsedTime(`Before ${llmName.toUpperCase()} Batch ${batchNumber}`);

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
    const response = await fetchWithTimeout(
      llm.endpoint(llm.modelName, llm.apiKey),
      {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      },
      API_TIMEOUT_MS
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [${llmName.toUpperCase()}] API error:`, response.status);
      
      if (response.status === 404 || errorText.includes('not found')) {
        throw new Error(`Model "${llm.modelName}" not found`);
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

    const batchTime = ((Date.now() - batchStartTime) / 1000).toFixed(1);
    console.log(`✅ [${llmName.toUpperCase()}] Batch ${batchNumber}: Got ${normalized.length}/${batchSize} valid questions in ${batchTime}s`);
    logElapsedTime(`After ${llmName.toUpperCase()} Batch ${batchNumber}`);

    return normalized;

  } catch (error) {
    const batchTime = ((Date.now() - batchStartTime) / 1000).toFixed(1);
    
    if (error.message.includes('timeout')) {
      console.error(`⏱️ [${llmName.toUpperCase()}] TIMEOUT after ${batchTime}s - switching to next LLM`);
    } else {
      console.error(`❌ [${llmName.toUpperCase()}] Failed in ${batchTime}s:`, error.message);
    }
    
    throw error;
  }
};

// ============================================================================
// MAIN GENERATION FUNCTION
// ============================================================================

export const generateQuestions = async (examName, totalCount) => {
  startGenerationTimer();
  
  console.log(`\n🚀 Starting question generation for ${examName}`);
  console.log(`🎯 Target: ${totalCount} questions`);
  console.log(`📊 Using batch size: ${MAX_BATCH_SIZE}`);
  console.log(`⏱️ Timeout: ${API_TIMEOUT_MS / 1000}s per API call`);
  console.log(`🔄 Multi-LLM fallback: Together.ai Llama 3.1 → Gemini 2.0 → DeepSeek\n`);

  questionAccumulator = [];

  const MAX_ATTEMPTS = 5;
  const LLM_PRIORITY = ['together', 'gemini', 'deepseek'];
  
  let attemptNumber = 0;

  while (attemptNumber < MAX_ATTEMPTS && questionAccumulator.length < totalCount) {
    attemptNumber++;
    
    const stillNeeded = totalCount - questionAccumulator.length;
    console.log(`\n🔄 ATTEMPT ${attemptNumber}/${MAX_ATTEMPTS}`);
    console.log(`📊 Current: ${questionAccumulator.length}/${totalCount} | Still need: ${stillNeeded}`);
    logElapsedTime("Current Progress");

    const numBatches = Math.ceil(stillNeeded / MAX_BATCH_SIZE);
    console.log(`📦 Will generate ${numBatches} batches`);

    for (let i = 0; i < numBatches; i++) {
      const remaining = totalCount - questionAccumulator.length;
      
      if (remaining <= 0) {
        console.log(`✅ Target reached! Have ${questionAccumulator.length} questions`);
        logElapsedTime("Target Reached");
        break;
      }

      const batchSize = Math.min(MAX_BATCH_SIZE, remaining);
      let batchQuestions = null;

      for (const llmName of LLM_PRIORITY) {
        try {
          batchQuestions = await generateBatchWithLLM(llmName, examName, batchSize, i + 1, attemptNumber);
          
          if (batchQuestions && batchQuestions.length > 0) {
            break;
          }
        } catch (error) {
          console.warn(`⚠️ ${llmName} failed, trying next LLM...`);
          continue;
        }
      }

      if (!batchQuestions || batchQuestions.length === 0) {
        console.error(`❌ All LLMs failed for batch ${i + 1}`);
        
        if (i < numBatches - 1) {
          console.log(`⏭️ Skipping failed batch, continuing...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        continue;
      }

      const newQuestions = batchQuestions.filter(newQ =>
        !questionAccumulator.some(existingQ => existingQ.question === newQ.question)
      );

      questionAccumulator = questionAccumulator.concat(newQuestions);

      console.log(`📈 Accumulator: ${questionAccumulator.length}/${totalCount} total questions`);

      if (i < numBatches - 1 && questionAccumulator.length < totalCount) {
        console.log('⏳ Waiting 2 seconds...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      if (questionAccumulator.length >= totalCount) {
        console.log(`🎉 Target reached at ${questionAccumulator.length} questions!`);
        logElapsedTime("Final Target Reached");
        break;
      }
    }

    if (questionAccumulator.length >= totalCount) {
      break;
    }

    if (attemptNumber < MAX_ATTEMPTS && questionAccumulator.length < totalCount) {
      console.log(`\n⏳ Waiting 2 seconds before next attempt...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  if (questionAccumulator.length === 0) {
    throw new Error("Failed to generate any questions. Please check your API keys and try again.");
  }

  const finalQuestions = questionAccumulator.slice(0, totalCount);

  const totalTime = getElapsedTime();
  const minutes = Math.floor(totalTime / 60);
  const seconds = totalTime % 60;

  console.log(`\n✅ ========== GENERATION COMPLETE ==========`);
  console.log(`📊 Generated: ${finalQuestions.length}/${totalCount} questions`);
  console.log(`🔄 Total attempts: ${attemptNumber}`);
  console.log(`💰 Efficiency: ${(finalQuestions.length / attemptNumber).toFixed(1)} questions per attempt average`);
  console.log(`⏱️ TOTAL TIME: ${minutes} minutes ${seconds} seconds (${totalTime}s)`);
  console.log(`⚡ Speed: ${(finalQuestions.length / (totalTime / 60)).toFixed(1)} questions per minute`);
  console.log(`==========================================\n`);

  if (finalQuestions.length < totalCount) {
    const percentage = Math.round((finalQuestions.length / totalCount) * 100);
    console.warn(`⚠️ Generated ${finalQuestions.length}/${totalCount} questions (${percentage}%)`);
    
    if (percentage < 80) {
      throw new Error(`Only generated ${finalQuestions.length}/${totalCount} questions (${percentage}%). Please try again.`);
    }
  }

  return finalQuestions;
}
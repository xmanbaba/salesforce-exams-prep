// utils/questionUtils.js
// FIXED: Question accumulator that never wastes generated questions

import { EXAM_CONFIGS } from '../config/examConfig';

// API Configuration
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
const modelName = import.meta.env.VITE_GEMINI_MODEL_NAME || "gemini-2.5-flash";

// Batch size - reduced for reliability
const MAX_BATCH_SIZE = 12;

// Question accumulator - persists across retries
let questionAccumulator = [];

// Fisher-Yates shuffle
export const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Randomize questions
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

// Certification prompts
const getCertificationPrompt = (examName, count) => {
  const prompts = {
    'Salesforce Certified Platform Foundations': `Generate ${count} unique Salesforce Platform Foundations practice questions.
TOPICS: Salesforce Ecosystem (32%), Navigation (28%), Data Model (25%), Reports & Dashboards (15%)
DIFFICULTY: 30% Easy, 50% Medium, 20% Hard`,

    'Salesforce Certified Platform Administrator': `Generate ${count} unique Salesforce Platform Administrator practice questions.
TOPICS: Configuration (20%), Object Manager (20%), Sales/Marketing (12%), Service/Support (11%), Productivity (7%), Data/Analytics (14%), Automation (16%)`,

    'Salesforce Certified Agentforce Specialist': `Generate ${count} unique Salesforce Agentforce Specialist practice questions.
TOPICS: Prompt Engineering (30%), Agentforce Concepts (30%), Data Cloud (20%), Service Cloud (10%), Sales Cloud (10%)`
  };

  return prompts[examName] || prompts['Salesforce Certified Platform Foundations'];
};

// JSON repair
const repairJSON = (text) => {
  let repaired = text;
  repaired = repaired.replace(/\}(\s+)\{/g, '},$1{');
  repaired = repaired.replace(/\}(\s+)"([a-zA-Z])/g, '},$1"$2');
  repaired = repaired.replace(/\](\s+)"([a-zA-Z])/g, '],$1"$2');
  repaired = repaired.replace(/"(\s+)"/g, '",$1"');
  repaired = repaired.replace(/,+/g, ',');
  repaired = repaired.replace(/,(\s*[\]}])/g, '$1');
  return repaired;
};

// Clean JSON
const cleanAndExtractJSON = (text) => {
  if (!text) throw new Error("Empty API response");

  let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');
  
  if (firstBracket === -1 || lastBracket === -1) {
    throw new Error("No valid JSON array found");
  }
  
  cleaned = cleaned.slice(firstBracket, lastBracket + 1);
  cleaned = repairJSON(cleaned);
  cleaned = cleaned.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
  
  const openBrackets = (cleaned.match(/\{/g) || []).length;
  const closeBrackets = (cleaned.match(/\}/g) || []).length;
  
  if (openBrackets > closeBrackets) {
    const lastComplete = cleaned.lastIndexOf('},');
    if (lastComplete > 0) {
      cleaned = cleaned.substring(0, lastComplete + 1) + ']';
      console.log("🔧 Removed incomplete objects");
    }
  }

  return cleaned;
};

// Normalize question
const normalizeQuestion = (q, index) => {
  if (!q.question || !q.options || !q.answer || !q.explanation) {
    return null;
  }

  let opts = [];
  let normalizedAnswer = q.answer.trim().toUpperCase();

  if (q.questionType === 'true-false') {
    opts = ['True', 'False'];
    normalizedAnswer = (normalizedAnswer === 'TRUE' || normalizedAnswer === 'A') ? 'A' : 'B';
  } else {
    opts = q.options.map(opt => 
      String(opt).replace(/^[A-D][\.\)]\s*/i, '').trim()
    ).filter(opt => opt.length > 0);
    
    if (opts.length < 2) return null;
    
    while (opts.length < 4) {
      opts.push(`Option ${String.fromCharCode(65 + opts.length)}`);
    }
    
    if (!['A', 'B', 'C', 'D'].includes(normalizedAnswer)) {
      normalizedAnswer = 'A';
    }
  }

  return {
    questionType: q.questionType || 'multiple-choice',
    question: q.question.trim(),
    options: opts,
    answer: normalizedAnswer,
    explanation: q.explanation.trim()
  };
};

// Generate single batch
const generateBatch = async (examName, batchSize, batchNumber, attemptNumber) => {
  console.log(`📦 Attempt ${attemptNumber}, Batch ${batchNumber}: Requesting ${batchSize} questions...`);
  
  const systemPrompt = getCertificationPrompt(examName, batchSize);
  
  const fullPrompt = `${systemPrompt}

CRITICAL: Return ONLY valid JSON array. No markdown, no text, no code fences.

[
  {
    "questionType": "multiple-choice",
    "question": "Question text?",
    "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
    "answer": "A",
    "explanation": "Explanation text."
  }
]

RULES:
- NO letter prefixes in options
- Answer: "A", "B", "C", or "D"
- All fields required
- Valid JSON only
- Exactly ${batchSize} questions`;

  const payload = {
    contents: [{ parts: [{ text: fullPrompt }] }],
    generationConfig: {
      temperature: 0.5,
      topP: 0.85,
      topK: 30,
      maxOutputTokens: 3072
    }
  };

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`API error (${response.status})`);
  }

  const result = await response.json();
  const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!jsonText) {
    throw new Error("Empty API response");
  }

  const cleaned = cleanAndExtractJSON(jsonText);
  const parsed = JSON.parse(cleaned);
  
  if (!Array.isArray(parsed)) {
    throw new Error("Invalid response format");
  }

  const normalized = parsed.map((q, i) => normalizeQuestion(q, i)).filter(q => q !== null);
  
  console.log(`✅ Attempt ${attemptNumber}, Batch ${batchNumber}: Got ${normalized.length}/${batchSize} valid questions`);
  
  return normalized;
};

// MAIN FUNCTION - with question accumulator
export const generateQuestions = async (examName, totalCount) => {
  console.log(`\n🚀 Starting question generation for ${examName}`);
  console.log(`🎯 Target: ${totalCount} questions`);
  console.log(`📊 Using batch size: ${MAX_BATCH_SIZE}`);
  
  if (!apiKey) {
    throw new Error("Gemini API key not configured");
  }

  // Reset accumulator for new exam generation
  questionAccumulator = [];
  
  const MAX_ATTEMPTS = 5; // Increased from 3
  let attemptNumber = 0;
  
  while (attemptNumber < MAX_ATTEMPTS && questionAccumulator.length < totalCount) {
    attemptNumber++;
    
    const stillNeeded = totalCount - questionAccumulator.length;
    console.log(`\n🔄 ATTEMPT ${attemptNumber}/${MAX_ATTEMPTS}`);
    console.log(`📊 Current: ${questionAccumulator.length}/${totalCount} | Still need: ${stillNeeded}`);
    
    // Calculate batches needed for remaining questions
    const numBatches = Math.ceil(stillNeeded / MAX_BATCH_SIZE);
    console.log(`📦 Will generate ${numBatches} batches`);
    
    for (let i = 0; i < numBatches; i++) {
      const remaining = totalCount - questionAccumulator.length;
      if (remaining <= 0) {
        console.log(`✅ Target reached! Have ${questionAccumulator.length} questions`);
        break;
      }
      
      const batchSize = Math.min(MAX_BATCH_SIZE, remaining);
      
      try {
        const batchQuestions = await generateBatch(examName, batchSize, i + 1, attemptNumber);
        
        // Add to accumulator (no duplicates)
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
        
      } catch (batchError) {
        console.error(`❌ Batch ${i + 1} failed:`, batchError.message);
        
        // Continue to next batch instead of failing completely
        if (i < numBatches - 1) {
          console.log(`⏭️ Skipping failed batch, continuing...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
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
    throw new Error("Failed to generate any questions. Please check your API key and try again.");
  }

  // Return exactly what we have (or trim if over)
  const finalQuestions = questionAccumulator.slice(0, totalCount);
  
  console.log(`\n✅ GENERATION COMPLETE`);
  console.log(`📊 Generated: ${finalQuestions.length}/${totalCount} questions`);
  console.log(`🔄 Total attempts: ${attemptNumber}`);
  console.log(`💰 Token efficiency: ${(finalQuestions.length / attemptNumber / numBatches).toFixed(1)} questions per batch average\n`);
  
  if (finalQuestions.length < totalCount) {
    console.warn(`⚠️ Generated ${finalQuestions.length}/${totalCount} questions (${Math.round(finalQuestions.length/totalCount*100)}%)`);
  }
  
  return finalQuestions;
};
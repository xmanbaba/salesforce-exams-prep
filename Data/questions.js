const questionsData = {
  'Salesforce Associate': [
    {
      question: "Which of the following describes a Salesforce Administrator?",
      options: ["Manages the Salesforce system and supports users.", "Develops custom applications on the Salesforce platform.", "Designs and maintains the company's network infrastructure.", "Handles customer service inquiries via phone."],
      answer: "Manages the Salesforce system and supports users.",
      explanation: "A Salesforce Administrator is a professional responsible for managing the Salesforce system, customizing it to meet business needs, and providing technical support to users."
    },
    {
      question: "What is the primary function of a Lead in Salesforce?",
      options: ["A qualified prospect who is ready to buy.", "A record that represents a new or unqualified potential customer.", "A customer who has purchased a product or service.", "An individual who has signed up for a company's newsletter."],
      answer: "A record that represents a new or unqualified potential customer.",
      explanation: "In Salesforce, a Lead is typically an unqualified prospect, someone who has shown interest in a product or service but has not yet been vetted as a potential buyer."
    },
    {
      question: "In Salesforce, which object is used to track customer support cases?",
      options: ["Account", "Contact", "Case", "Opportunity"],
      answer: "Case",
      explanation: "The Case object is the standard Salesforce object used to track and manage customer support issues, questions, or requests. Each case represents a specific customer inquiry."
    },
  ],
  'Salesforce Admin Exams': [
    {
      question: "What is a Profile in Salesforce?",
      options: ["A collection of settings and permissions that determines what the user can do.", "A report that shows user login history.", "A visual representation of the data model.", "A tool for creating custom fields."],
      answer: "A collection of settings and permissions that determines what the user can do.",
      explanation: "A Profile defines a user's permissions and settings, controlling what they can view, create, edit, and delete within Salesforce. Every user must have exactly one profile."
    },
    {
      question: "Which feature is used to automate business processes without writing code?",
      options: ["Apex Triggers", "Visualforce Pages", "Flow Builder", "Custom Apex Classes"],
      answer: "Flow Builder",
      explanation: "Flow Builder is the declarative automation tool in Salesforce for building complex business processes, guiding users through screens, or creating logical automations without writing any code."
    },
    {
      question: "What is the purpose of a Validation Rule?",
      options: ["To prevent users from saving a record if certain criteria are not met.", "To automatically update fields when a record is saved.", "To send an email alert to a user.", "To create a new record."],
      answer: "To prevent users from saving a record if certain criteria are not met.",
      explanation: "A Validation Rule verifies that the data a user enters meets specific criteria before they can save a record. It ensures data integrity and quality."
    },
  ],
  'Salesforce AI Agentforce': [
    {
      question: "Which Salesforce product focuses on building and deploying AI-powered applications?",
      options: ["Einstein Platform", "Sales Cloud Einstein", "Service Cloud Einstein", "Marketing Cloud Einstein"],
      answer: "Einstein Platform",
      explanation: "The Einstein Platform is a suite of AI technologies and tools within Salesforce that allows developers and administrators to build, deploy, and integrate AI into their applications."
    },
    {
      question: "What is a key benefit of using AI in Salesforce Service Cloud?",
      options: ["Automating lead qualification.", "Predicting customer churn.", "Streamlining case resolution with AI-driven recommendations.", "Generating automated sales reports."],
      answer: "Streamlining case resolution with AI-driven recommendations.",
      explanation: "AI in Service Cloud, often called Service Cloud Einstein, helps agents by providing them with intelligent recommendations, automating case classification, and suggesting next best actions, which speeds up case resolution."
    },
    {
      question: "How does Salesforce AI Agentforce help with customer service?",
      options: ["It handles all incoming customer inquiries automatically.", "It provides agents with real-time, relevant information and next-best actions.", "It replaces the need for human customer service agents.", "It only works with voice calls."],
      answer: "It provides agents with real-time, relevant information and next-best actions.",
      explanation: "Salesforce AI Agentforce is designed to augment human agents, not replace them. It uses AI to provide intelligent assistance, giving agents the right information at the right time to resolve customer issues more efficiently."
    },
  ],
};

export default questionsData;

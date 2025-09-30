 // Reusable UI Components

export const Button = ({ children, onClick, disabled, className = '', icon: Icon, color = 'bg-blue-600 hover:bg-blue-700' }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`flex items-center justify-center space-x-2 px-6 py-3 rounded-xl font-semibold text-white transition duration-200 shadow-md ${color} disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
  >
    {Icon && <Icon size={20} />}
    <span>{children}</span>
  </button>
);

export const Card = ({ children, className = '' }) => (
  <div className={`bg-white p-6 md:p-8 rounded-2xl shadow-xl ${className}`}>
    {children}
  </div>
);
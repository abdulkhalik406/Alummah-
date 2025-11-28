import React from 'react';
import { LucideIcon } from 'lucide-react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, className = '', onClick }) => (
  <div 
    onClick={onClick}
    className={`bg-white rounded-xl shadow-md p-4 border border-gray-100 ${onClick ? 'cursor-pointer active:scale-95 transition-transform' : ''} ${className}`}
  >
    {children}
  </div>
);

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ variant = 'primary', fullWidth, className = '', ...props }) => {
  const baseStyle = "px-4 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-200",
    secondary: "bg-amber-500 text-white hover:bg-amber-600",
    danger: "bg-red-500 text-white hover:bg-red-600",
    outline: "border-2 border-emerald-600 text-emerald-600 hover:bg-emerald-50"
  };

  return (
    <button 
      className={`${baseStyle} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    />
  );
};

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export const Input: React.FC<InputProps> = ({ label, className = '', ...props }) => (
  <div className="mb-4">
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <input 
      className={`w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all ${className}`}
      {...props}
    />
  </div>
);

export const MenuTile: React.FC<{ icon: LucideIcon, label: string, onClick: () => void, color?: string }> = ({ icon: Icon, label, onClick, color = "text-emerald-600" }) => (
  <div 
    onClick={onClick}
    className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-3 active:scale-95 transition-transform cursor-pointer hover:shadow-md"
  >
    <div className={`p-4 rounded-full bg-gray-50 ${color}`}>
      <Icon size={32} />
    </div>
    <span className="font-semibold text-gray-800 text-center text-sm">{label}</span>
  </div>
);

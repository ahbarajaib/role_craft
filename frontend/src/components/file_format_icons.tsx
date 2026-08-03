import React from "react";

/**
 * Microsoft Word (.docx) Brand Logo Icon
 */
export function WordLogoIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="4" fill="#185ABD" />
      <path
        d="M6.2 7.2H8.3L9.9 14.2L11.5 9.6L12.5 9.6L14.1 14.2L15.7 7.2H17.8L15.3 16.8H13.3L12 12.1L10.7 16.8H8.7L6.2 7.2Z"
        fill="white"
      />
    </svg>
  );
}

/**
 * Adobe PDF (.pdf) Brand Logo Icon
 */
export function PdfLogoIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="4" fill="#E5252A" />
      <path
        d="M5.5 8.2H8.1C9 8.2 9.7 8.7 9.7 9.5C9.7 10.3 9 10.8 8.1 10.8H6.8V13.8H5.5V8.2ZM6.8 9.2V9.8H8C8.3 9.8 8.5 9.6 8.5 9.5C8.5 9.4 8.3 9.2 8 9.2H6.8ZM11 8.2H13.2C14.7 8.2 15.7 9.2 15.7 11C15.7 12.8 14.7 13.8 13.2 13.8H11V8.2ZM12.3 9.2V12.8H13.1C14 12.8 14.5 12 14.5 11C14.5 10 14 9.2 13.1 9.2H12.3ZM16.8 8.2H20.2V9.2H18.1V10.4H19.9V11.4H18.1V13.8H16.8V8.2Z"
        fill="white"
      />
    </svg>
  );
}

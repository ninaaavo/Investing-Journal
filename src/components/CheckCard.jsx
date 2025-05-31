import { CheckCircle, Circle } from "lucide-react";

export default function CompanyQualityCheck({ title = "Company Quality", criteria = [] }) {
  return (
    <div className="p-8 mt-4 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.1)] rounded-xl w-80">
      <h2 className="text-xl font-semibold text-primary mb-4">{title}</h2>
      <ul className="space-y-4">
        {criteria.map((item, index) => (
          <li key={index} className="flex flex-col space-y-1">
            {item.type === "check" && (
              <div className="flex items-start space-x-3">
                <div className="mt-0.5">
                  {item.checked ? (
                    <CheckCircle className="w-5 h-5 text-primary" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-300" />
                  )}
                </div>
                <span className="text-sm text-[var(--color-text)] leading-snug">{item.text}</span>
              </div>
            )}
            {item.type === "field" && (
              <ul className="list-disc ml-6 text-sm text-[var(--color-text)] leading-snug">
                <li>
                  {(() => {
                    const [before, after] = item.text.split("___");
                    return (
                      <>
                        {before}
                        <span className="font-semibold text-primary">{item.value}</span>
                        {after}
                      </>
                    );
                  })()}
                </li>
              </ul>
            )}
            {item.type === "textarea" && (
              <div>
                <p className="text-sm text-[var(--color-text)] leading-snug mb-1">{item.text}</p>
                <div className="bg-muted text-sm text-[var(--color-text)] p-3 rounded-md whitespace-pre-line">
                  {item.value}
                </div>
              </div>
            )}
            {item.note && (
              <p className="ml-8 text-xs text-[var(--color-text)] italic">{item.note}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

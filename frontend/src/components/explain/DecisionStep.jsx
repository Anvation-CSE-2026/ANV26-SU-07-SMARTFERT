import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardBody } from "../common/Card";

export function DecisionStep({ index, title, description, visual, technical }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center shrink-0">
        <div className="w-9 h-9 rounded-full bg-green-600 text-white flex items-center justify-center font-semibold text-sm">
          {index}
        </div>
        <div className="flex-1 w-0.5 bg-green-200 mt-1" />
      </div>
      <Card className="flex-1 mb-6">
        <CardBody>
          <h3 className="font-semibold text-green-900 mb-1">{title}</h3>
          <p className="text-sm text-green-800 mb-3">{description}</p>
          {visual && <div className="mb-2">{visual}</div>}
          {technical && (
            <div>
              <button
                onClick={() => setOpen((o) => !o)}
                className="text-xs font-medium text-green-700 hover:underline"
                aria-expanded={open}
              >
                {open ? t("common.hideTechnicalDetail") : t("common.showTechnicalDetail")}
              </button>
              {open && <div className="mt-2 bg-mint-50 rounded-lg p-3 text-xs text-green-800 font-mono whitespace-pre-wrap">{technical}</div>}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

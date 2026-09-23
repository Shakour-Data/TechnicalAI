"use client";

import { useState, useEffect } from 'react';
import { useTheme } from '@/lib/theme-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import useApiSettingsStore from '@/lib/api-settings-store';
import { BrainCircuit, Key, Save, X, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function ApiSettingsPage() {
  const { colors } = useTheme();
  const { apiKey, setApiKey, clearApiKey } = useApiSettingsStore();
  const [inputValue, setInputValue] = useState(apiKey || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Initialize input value from store
  useEffect(() => {
    setInputValue(apiKey || '');
  }, [apiKey]);

  // Validate API key (basic validation - should be non-empty string)
  useEffect(() => {
    const isInputValid = inputValue.trim().length > 0 && inputValue.trim().length > 10;
    setIsValid(isInputValid);
    setError(null);
    
    if (inputValue.trim().length > 0 && inputValue.trim().length <= 10) {
      setError('کلید API باید حداقل 10 کاراکتر باشد');
    }
  }, [inputValue]);

  const handleSave = async () => {
    if (!isValid) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Simulate API validation (you could actually test the key against a models endpoint)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setApiKey(inputValue.trim());
      setShowSuccess(true);
      
      // Hide success message after 3 seconds
      setTimeout(() => {
        setShowSuccess(false);
      }, 3000);
    } catch (err) {
      setError('خطا در اعتبارسنجی کلید API');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setInputValue('');
    clearApiKey();
    setError(null);
    setIsValid(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isValid && !isLoading) {
      handleSave();
    }
  };

  return (
    <div 
      dir="rtl" 
      className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8"
      style={{ fontFamily: 'Vazirmatn, sans-serif' }}
    >
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ 
                background: colors.primaryBg, 
                border: `2px solid ${colors.border}`
              }}
            >
              <BrainCircuit className="w-6 h-6" style={{ color: colors.primary }} />
            </div>
            <div>
              <h1 
                className="text-2xl font-bold text-gray-900 mb-1"
                style={{ color: colors.pageFg }}
              >
                تنظیمات هوش مصنوعی
              </h1>
              <p 
                className="text-sm"
                style={{ color: colors.cardSubFg }}
              >
                برای استفاده از تحلیل متنی هوشمند، کلید API خود را وارد کنید
              </p>
            </div>
          </div>
        </div>

        {/* Settings Card */}
        <Card 
          className="shadow-lg border-0"
          style={{ 
            background: colors.cardBg, 
            borderColor: colors.cardBorder
          }}
        >
          <CardHeader>
            <CardTitle 
              className="text-lg"
              style={{ color: colors.cardFg }}
            >
              تنظیمات کلید API
            </CardTitle>
            <CardDescription 
              className="text-sm"
              style={{ color: colors.cardSubFg }}
            >
              کلید API شما برای دسترسی به مدل‌های هوش مصنوعی متنی (مانند GPT، Claude، یا هر مدل OpenAI-compatible دیگر)
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* API Key Input */}
            <div className="space-y-2">
              <label 
                htmlFor="api-key"
                className="text-sm font-medium block"
                style={{ color: colors.cardFg }}
              >
                کلید API
              </label>
              <div className="relative">
                <Key 
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4"
                  style={{ color: colors.cardSubFg }}
                />
                <Input
                  id="api-key"
                  type="password"
                  placeholder="sk-your-api-key-here..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading}
                  className="pr-10 font-mono text-sm"
                  style={{ 
                    borderColor: error ? colors.bearColor : colors.inputBorder,
                    background: colors.inputBg
                  }}
                />
              </div>
              {error && (
                <div className="flex items-center gap-2 text-sm" style={{ color: colors.bearColor }}>
                  <AlertCircle className="w-4 h-4" />
                  <span>{error}</span>
                </div>
              )}
              <p 
                className="text-xs"
                style={{ color: colors.cardSubFg }}
              >
                کلید API شما را از ارائه‌دهنده هوش مصنوعی دریافت کنید (مانند OpenAI، Anthropic، Azure، یا هر سرویس OpenAI-compatible دیگر)
              </p>
            </div>

            {/* Success Message */}
            {showSuccess && (
              <div 
                className="flex items-center gap-2 p-3 rounded-lg"
                style={{ 
                  background: colors.bullBg, 
                  border: `1px solid ${colors.bullColor}20`,
                  color: colors.bullColor
                }}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-sm font-medium">کلید API با موفقیت ذخیره شد</span>
              </div>
            )}

            {/* Info Box */}
            <div 
              className="p-4 rounded-lg border"
              style={{ 
                background: colors.primaryBg,
                borderColor: colors.border,
                color: colors.cardFg
              }}
            >
              <h4 className="text-sm font-medium mb-2">درباره کلید API:</h4>
              <ul className="text-xs space-y-1 font-light" style={{ color: colors.cardSubFg }}>
                <li>• کلید را از OpenAI, Anthropic, Azure, یا هر سرویس API compatible با OpenAI دریافت کنید</li>
                <li>• برای مدل‌های محلی، از vLLM یا cualquier servicio con punto de acceso compatible con OpenAI</li>
                <li>• کلید در مرورگر شما ذخیره می‌شود و برای تمام درخواست‌های تحلیل استفاده می‌شود</li>
                <li>• بخش توضیح‌دهنده تصویری بدون کلید API کار نمی‌کند</li>
              </ul>
            </div>
          </CardContent>
          
          <CardFooter className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={handleClear}
              disabled={isLoading || !inputValue}
              className="flex-1"
              style={{ 
                borderColor: colors.border,
                color: colors.cardSubFg
              }}
            >
              <X className="w-4 h-4 ml-2" />
              پاک کردن
            </Button>
            <Button
              onClick={handleSave}
              disabled={!isValid || isLoading}
              className="flex-1"
              style={{ 
                background: colors.primary,
                color: colors.primaryFg,
                opacity: (!isValid || isLoading) ? 0.5 : 1
              }}
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin ml-2" />
              ) : (
                <Save className="w-4 h-4 ml-2" />
              )}
              {isLoading ? 'در حال ذخیره...' : 'ذخیره کلید API'}
            </Button>
          </CardFooter>
        </Card>

        {/* Back to analysis link */}
        <div className="mt-6 text-center">
          <a 
            href="/"
            className="text-sm font-medium hover:underline transition-colors"
            style={{ color: colors.primary }}
          >
            ← بازگشت به صفحه تحلیل بازار
          </a>
        </div>
      </div>
    </div>
  );
}
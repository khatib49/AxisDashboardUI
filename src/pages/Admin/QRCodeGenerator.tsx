import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Select from "../../components/form/Select";
import Alert from "../../components/ui/alert/Alert";

export default function QRCodeGenerator() {
    const [url, setUrl] = useState("");
    const [qrSize, setQrSize] = useState(256);
    const [qrLevel, setQrLevel] = useState<"L" | "M" | "Q" | "H">("M");
    const [bgColor, setBgColor] = useState("#ffffff");
    const [fgColor, setFgColor] = useState("#000000");
    const [generatedUrl, setGeneratedUrl] = useState("");
    const [notification, setNotification] = useState<{
        variant: "success" | "error" | "warning" | "info";
        title: string;
        message: string;
    } | null>(null);

    // Auto-hide notification
    useState(() => {
        if (!notification) return;
        const timer = setTimeout(() => setNotification(null), 4000);
        return () => clearTimeout(timer);
    });

    const handleGenerate = () => {
        if (!url.trim()) {
            setNotification({
                variant: "error",
                title: "Validation Error",
                message: "Please enter a URL to generate QR code",
            });
            return;
        }

        // Basic URL validation
        try {
            new URL(url);
            setGeneratedUrl(url);
            setNotification({
                variant: "success",
                title: "Success",
                message: "QR Code generated successfully",
            });
        } catch {
            setNotification({
                variant: "warning",
                title: "Invalid URL",
                message: "The URL format seems invalid. QR code will be generated anyway.",
            });
            setGeneratedUrl(url);
        }
    };

    const handleDownload = () => {
        if (!generatedUrl) {
            setNotification({
                variant: "error",
                title: "Error",
                message: "Please generate a QR code first",
            });
            return;
        }

        const svg = document.getElementById("qr-code-svg");
        if (!svg) return;

        const svgData = new XMLSerializer().serializeToString(svg);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const img = new Image();

        canvas.width = qrSize;
        canvas.height = qrSize;

        img.onload = () => {
            ctx?.drawImage(img, 0, 0);
            canvas.toBlob((blob) => {
                if (blob) {
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = `qrcode-${Date.now()}.png`;
                    link.click();
                    URL.revokeObjectURL(url);
                    setNotification({
                        variant: "success",
                        title: "Downloaded",
                        message: "QR code downloaded successfully",
                    });
                }
            });
        };

        img.src = `data:image/svg+xml;base64,${btoa(svgData)}`;
    };

    const handleClear = () => {
        setUrl("");
        setGeneratedUrl("");
        setQrSize(256);
        setQrLevel("M");
        setBgColor("#ffffff");
        setFgColor("#000000");
        setNotification({
            variant: "info",
            title: "Cleared",
            message: "Form cleared successfully",
        });
    };

    return (
        <div className="p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">QR Code Generator</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Generate QR codes for URLs, links, or any text content
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Panel - Configuration */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Configuration</h2>

                    <div className="space-y-4">
                        <div>
                            <Label>URL or Text *</Label>
                            <Input
                                type="text"
                                placeholder="https://example.com"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        handleGenerate();
                                    }
                                }}
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Enter a valid URL or any text to encode
                            </p>
                        </div>

                        <div>
                            <Label>QR Code Size</Label>
                            <Select
                                options={[
                                    { value: 128, label: "Small (128x128)" },
                                    { value: 256, label: "Medium (256x256)" },
                                    { value: 512, label: "Large (512x512)" },
                                    { value: 1024, label: "Extra Large (1024x1024)" },
                                ]}
                                defaultValue={qrSize}
                                onChange={(v) => setQrSize(Number(v))}
                            />
                        </div>

                        <div>
                            <Label>Error Correction Level</Label>
                            <Select
                                options={[
                                    { value: "L", label: "Low (7% correction)" },
                                    { value: "M", label: "Medium (15% correction)" },
                                    { value: "Q", label: "Quartile (25% correction)" },
                                    { value: "H", label: "High (30% correction)" },
                                ]}
                                defaultValue={qrLevel}
                                onChange={(v) => setQrLevel(v as "L" | "M" | "Q" | "H")}
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Higher levels allow damaged QR codes to still be readable
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Background Color</Label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={bgColor}
                                        onChange={(e) => setBgColor(e.target.value)}
                                        className="h-10 w-16 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                                    />
                                    <Input
                                        type="text"
                                        value={bgColor}
                                        onChange={(e) => setBgColor(e.target.value)}
                                        placeholder="#ffffff"
                                    />
                                </div>
                            </div>

                            <div>
                                <Label>Foreground Color</Label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={fgColor}
                                        onChange={(e) => setFgColor(e.target.value)}
                                        className="h-10 w-16 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                                    />
                                    <Input
                                        type="text"
                                        value={fgColor}
                                        onChange={(e) => setFgColor(e.target.value)}
                                        placeholder="#000000"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                            <button
                                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition font-medium"
                                onClick={handleGenerate}
                            >
                                Generate QR Code
                            </button>
                            <button
                                className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition font-medium"
                                onClick={handleClear}
                            >
                                Clear
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Panel - Preview */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Preview</h2>

                    <div className="flex flex-col items-center justify-center min-h-[400px]">
                        {generatedUrl ? (
                            <>
                                <div className="p-6 bg-gray-50 dark:bg-gray-900 rounded-lg mb-4">
                                    <QRCodeSVG
                                        id="qr-code-svg"
                                        value={generatedUrl}
                                        size={Math.min(qrSize, 300)}
                                        level={qrLevel}
                                        bgColor={bgColor}
                                        fgColor={fgColor}
                                        includeMargin={true}
                                    />
                                </div>

                                <div className="w-full max-w-md bg-gray-50 dark:bg-gray-900 rounded p-3 mb-4">
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Encoded URL:</p>
                                    <p className="text-sm text-gray-900 dark:text-white break-all font-mono">
                                        {generatedUrl}
                                    </p>
                                </div>

                                <button
                                    className="w-full max-w-md px-6 py-3 bg-green-600 text-white rounded hover:bg-green-700 transition font-medium flex items-center justify-center gap-2"
                                    onClick={handleDownload}
                                >
                                    <svg
                                        className="w-5 h-5"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                        />
                                    </svg>
                                    Download QR Code
                                </button>
                            </>
                        ) : (
                            <div className="text-center text-gray-400 dark:text-gray-500">
                                <svg
                                    className="w-24 h-24 mx-auto mb-4 opacity-50"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={1}
                                        d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                                    />
                                </svg>
                                <p className="text-lg font-medium mb-2">No QR Code Generated</p>
                                <p className="text-sm">
                                    Enter a URL and click "Generate QR Code" to see the preview
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded">
                            <svg
                                className="w-5 h-5 text-blue-600 dark:text-blue-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                            </svg>
                        </div>
                        <div>
                            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">Quick Tip</h3>
                            <p className="text-sm text-blue-700 dark:text-blue-300">
                                Press Enter after typing the URL to quickly generate the QR code
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-green-100 dark:bg-green-900 rounded">
                            <svg
                                className="w-5 h-5 text-green-600 dark:text-green-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                            </svg>
                        </div>
                        <div>
                            <h3 className="font-semibold text-green-900 dark:text-green-100 mb-1">Best Practice</h3>
                            <p className="text-sm text-green-700 dark:text-green-300">
                                Use higher error correction for QR codes that might get damaged or obscured
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded">
                            <svg
                                className="w-5 h-5 text-purple-600 dark:text-purple-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                                />
                            </svg>
                        </div>
                        <div>
                            <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-1">Customization</h3>
                            <p className="text-sm text-purple-700 dark:text-purple-300">
                                Customize colors to match your brand while maintaining good contrast
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Toast Notification */}
            <div className="fixed bottom-6 right-6 z-50">
                {notification && (
                    <div className="max-w-sm">
                        <Alert
                            variant={notification.variant}
                            title={notification.title}
                            message={notification.message}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

const SETTINGS_STORAGE_KEY = "pos_settings";
export const DEFAULT_SETTINGS = {
    restaurantName: "",
    phone: "",
    email : "",
    address: "",
    currency: "INR",
    invoicePrefix:"INV",
    footer: "",
    taxEnabled: true,
    cgstRate: 2.5,
    sgstRate:2.5,
};

export const getSettings = ()=>{
    try{
        const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);

        if(!stored){
            return{...DEFAULT_SETTINGS};
        }
        const parsed  = JSON.parse(stored);
        return{
            ...DEFAULT_SETTINGS,
            ...(parsed && typeof parsed === "object" ? parsed:{}),
        };
    } catch (error){
        console.error("Unable to read settings:",error);
        return {...DEFAULT_SETTINGS};
    }
};

export const saveSettings = (settings) => {
    const updatedSettings = {
        ...DEFAULT_SETTINGS,...settings,
    };

    localStorage.setItem(SETTINGS_STORAGE_KEY , JSON.stringify(updatedSettings));

    window.dispatchEvent(new Event("settingsUpdated"));

    return updatedSettings;
};

export const formatMoney = (value , currency) => {
    const selectedCurrency = currency || getSettings().currency || "INR";

    try{
        return new Intl.NumberFormat("en-IN",{
            style:"currency",
            currency: selectedCurrency,
            maximumFractionDigits :2,
        }).format(Number(value) || 0);
    } catch {
        return new Intl.NumberFormat("en-IN",{
            maximumFractionDigits:2,
        }).format(Number(value) || 0);
    }
};

export const getNextInvoiceNumber = () =>{
    const settings = getSettings();
    const prefix = String(settings.invoicePrefix || "INV").trim() || "INV";

    return `${prefix}-${Date.now()}`;
};


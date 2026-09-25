import { useEffect, useState } from "react";
import {
  Store,
  Phone,
  Mail,
  MapPin,
  Receipt,
  Save,
  RotateCcw,
  Percent,
  CheckCircle,
  AlertCircle,
  Settings as SettingsIcon,
} from "lucide-react";

import {
  DEFAULT_SETTINGS,
  getSettings,
  saveSettings,
} from "../../utils/settingStore";

import "./Settings.css";

function Settings() {
  const [formData, setFormData] = useState(() => getSettings());
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  useEffect(() => {
    const syncSettings = () => {
      setFormData(getSettings());
    };

    window.addEventListener("settingsUpdated", syncSettings);

    return () => {
      window.removeEventListener("settingsUpdated", syncSettings);
    };
  }, []);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));

    setMessage("");
  };

  const handleSave = (event) => {
    event.preventDefault();

    if (!formData.restaurantName.trim()) {
      setMessage("Please enter the restaurant name.");
      setMessageType("error");
      return;
    }

    if (!formData.invoicePrefix.trim()) {
      setMessage("Please enter an invoice prefix.");
      setMessageType("error");
      return;
    }

    const cgstRate = Number(formData.cgstRate);
    const sgstRate = Number(formData.sgstRate);

    if (
      !Number.isFinite(cgstRate) ||
      !Number.isFinite(sgstRate) ||
      cgstRate < 0 ||
      sgstRate < 0
    ) {
      setMessage("Enter valid non-negative CGST and SGST rates.");
      setMessageType("error");
      return;
    }

    const updatedSettings = saveSettings({
      ...formData,
      restaurantName: formData.restaurantName.trim(),
      invoicePrefix: formData.invoicePrefix.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim(),
      address: formData.address.trim(),
      footer: formData.footer.trim(),
      cgstRate,
      sgstRate,
    });

    setFormData(updatedSettings);
    setMessage("Settings saved successfully.");
    setMessageType("success");
  };

  const handleReset = () => {
    const confirmed = window.confirm(
      "Reset all settings to their default values?",
    );

    if (!confirmed) return;

    const resetSettings = saveSettings({ ...DEFAULT_SETTINGS });

    setFormData(resetSettings);
    setMessage("Settings have been reset.");
    setMessageType("success");
  };

  return (
    <div className="settings-page">
      <div className="settings-page-header">
        <div>
          <div className="settings-title-row">
            <div className="settings-title-icon">
              <SettingsIcon size={23} />
            </div>

            <div>
              <h1>Settings</h1>
              <p>
                Manage your restaurant information, billing preferences, and tax
                configuration.
              </p>
            </div>
          </div>
        </div>
      </div>

      {message && (
        <div className={`settings-alert ${messageType}`}>
          {messageType === "success" ? (
            <CheckCircle size={18} />
          ) : (
            <AlertCircle size={18} />
          )}
          <span>{message}</span>
        </div>
      )}

      <form className="settings-form" onSubmit={handleSave}>
        {/* Restaurant Information */}
        <section className="settings-card">
          <div className="settings-card-header">
            <div className="settings-section-icon">
              <Store size={20} />
            </div>

            <div>
              <h2>Restaurant Information</h2>
              <p>These details can be used on invoices and printed receipts.</p>
            </div>
          </div>

          <div className="settings-fields-grid">
            <div className="settings-field full-width">
              <label htmlFor="restaurantName">Restaurant Name</label>
              <div className="settings-input-wrapper">
                <Store size={17} />
                <input
                  id="restaurantName"
                  name="restaurantName"
                  type="text"
                  placeholder="Enter restaurant name"
                  value={formData.restaurantName}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="settings-field">
              <label htmlFor="phone">Phone Number</label>
              <div className="settings-input-wrapper">
                <Phone size={17} />
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="Enter phone number"
                  value={formData.phone}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="settings-field">
              <label htmlFor="email">Email Address</label>
              <div className="settings-input-wrapper">
                <Mail size={17} />
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="Enter email address"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="settings-field full-width">
              <label htmlFor="address">Restaurant Address</label>
              <div className="settings-input-wrapper textarea-wrapper">
                <MapPin size={17} />
                <textarea
                  id="address"
                  name="address"
                  placeholder="Enter restaurant address"
                  rows={3}
                  value={formData.address}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Billing Preferences */}
        <section className="settings-card">
          <div className="settings-card-header">
            <div className="settings-section-icon">
              <Receipt size={20} />
            </div>

            <div>
              <h2>Billing Preferences</h2>
              <p>
                Configure the currency, invoice numbering, and receipt footer.
              </p>
            </div>
          </div>

          <div className="settings-fields-grid">
            <div className="settings-field">
              <label htmlFor="currency">Currency</label>
              <select
                id="currency"
                name="currency"
                value={formData.currency}
                onChange={handleChange}
              >
                <option value="INR">INR - Indian Rupee (₹)</option>
                <option value="USD">USD - US Dollar ($)</option>
                <option value="EUR">EUR - Euro (€)</option>
                <option value="GBP">GBP - British Pound (£)</option>
              </select>
              <small>
                Used when formatting monetary amounts in connected pages.
              </small>
            </div>

            <div className="settings-field">
              <label htmlFor="invoicePrefix">Invoice Prefix</label>
              <input
                id="invoicePrefix"
                name="invoicePrefix"
                type="text"
                placeholder="e.g. INV"
                value={formData.invoicePrefix}
                onChange={handleChange}
                required
              />
              <small>
                Used when generating invoice numbers in the connected billing
                flow.
              </small>
            </div>

            <div className="settings-field full-width">
              <label htmlFor="footer">Invoice / Receipt Footer</label>
              <textarea
                id="footer"
                name="footer"
                rows={3}
                placeholder="e.g. Thank you for dining with us!"
                value={formData.footer}
                onChange={handleChange}
              />
              <small>
                This message can be displayed at the bottom of invoices and
                printed receipts.
              </small>
            </div>
          </div>
        </section>

        {/* Tax Configuration */}
        <section className="settings-card">
          <div className="settings-card-header">
            <div className="settings-section-icon">
              <Percent size={20} />
            </div>

            <div>
              <h2>Tax Configuration</h2>
              <p>Set the default tax preferences for billing.</p>
            </div>
          </div>

          <div className="settings-tax-toggle">
            <div>
              <h3>Enable Tax</h3>
              <p>
                Turn tax calculation on or off for the billing configuration.
              </p>
            </div>

            <label className="settings-switch">
              <input
                type="checkbox"
                name="taxEnabled"
                checked={Boolean(formData.taxEnabled)}
                onChange={handleChange}
              />
              <span className="settings-switch-slider" />
            </label>
          </div>

          {formData.taxEnabled && (
            <div className="settings-fields-grid tax-fields">
              <div className="settings-field">
                <label htmlFor="cgstRate">CGST Rate (%)</label>
                <div className="settings-input-wrapper">
                  <input
                    id="cgstRate"
                    name="cgstRate"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.cgstRate}
                    onChange={handleChange}
                  />
                  <span className="settings-input-suffix">%</span>
                </div>
              </div>

              <div className="settings-field">
                <label htmlFor="sgstRate">SGST Rate (%)</label>
                <div className="settings-input-wrapper">
                  <input
                    id="sgstRate"
                    name="sgstRate"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.sgstRate}
                    onChange={handleChange}
                  />
                  <span className="settings-input-suffix">%</span>
                </div>
              </div>

              <div className="settings-tax-summary full-width">
                <Percent size={17} />
                <span>
                  Combined default tax rate:{" "}
                  <strong>
                    {(Number(formData.cgstRate) || 0) +
                      (Number(formData.sgstRate) || 0)}
                    %
                  </strong>
                </span>
              </div>
            </div>
          )}

          {!formData.taxEnabled && (
            <div className="settings-tax-disabled">
              Tax is disabled in the settings configuration.
            </div>
          )}
        </section>

        {/* Actions */}
        <div className="settings-actions">
          <button
            type="button"
            className="settings-reset-button"
            onClick={handleReset}
          >
            <RotateCcw size={17} />
            Reset to Defaults
          </button>

          <button type="submit" className="settings-save-button">
            <Save size={17} />
            Save Settings
          </button>
        </div>
      </form>
    </div>
  );
}

export default Settings;

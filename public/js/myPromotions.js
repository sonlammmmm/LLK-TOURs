/* eslint-disable */
import { showAlert } from "./alerts.js";

export const initMyPromotions = () => {
  const buttons = document.querySelectorAll(".btn-copy-code");
  if (!buttons.length) return;

  buttons.forEach(btn => {
    btn.addEventListener("click", async () => {
      const code = btn.dataset.code;
      if (!code) return;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(code);
        } else {
          const textarea = document.createElement("textarea");
          textarea.value = code;
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand("copy");
          document.body.removeChild(textarea);
        }
        showAlert("success", `Đã sao chép mã ${code}`);
      } catch (err) {
        console.error("copy failed", err);
        showAlert("error", "Không thể sao chép mã, vui lòng thử lại.");
      }
    });
  });
};

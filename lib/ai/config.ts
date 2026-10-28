/** External AI is opt-in. A saved provider key alone never enables requests. */
export const aiEnabled = () => process.env.AI_ENABLED === "true";

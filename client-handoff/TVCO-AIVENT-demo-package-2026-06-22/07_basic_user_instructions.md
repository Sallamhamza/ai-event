# Basic User Instructions / تعليمات الاستخدام الأساسية

## English

### For Demo Operator

1. Open the demo URL in Chrome.
2. Allow microphone permission when prompted.
3. Use the language toggle to switch between English and Arabic.
4. Hold the microphone button while speaking.
5. Release the button after finishing the question.
6. Wait for the response to appear in the conversation area and play as voice.
7. Use short, clear questions during the demo.

### Recommended Demo Questions

- "Where do I collect my badge?"
- "What is the Wi-Fi password?"
- "How many CPD credits are available?"
- "أين أستلم بطاقتي؟"
- "ما هي كلمة مرور الواي فاي؟"
- "أين مكتب المعلومات الطبية؟"

### If Microphone Fails

If Chrome shows `Microphone error: network`, refresh the page and test again on a stable network. This error relates to the browser speech recognition service, not the event knowledge base.

### If Arabic Audio Sounds Wrong

Confirm the latest deployment is running and that the environment includes:

```env
DID_VOICE_ID_AR=ar-SA-HamedNeural
```

If browser TTS fallback is used, the device/browser must have an Arabic voice installed.

## العربية

### لمشغل العرض

1. افتح رابط العرض في متصفح Chrome.
2. اسمح باستخدام الميكروفون عند ظهور الطلب.
3. استخدم زر اللغة للتبديل بين الإنجليزية والعربية.
4. اضغط مع الاستمرار على زر الميكروفون أثناء التحدث.
5. ارفع يدك عن الزر بعد الانتهاء من السؤال.
6. انتظر ظهور الإجابة في منطقة المحادثة وتشغيلها صوتيًا.
7. استخدم أسئلة قصيرة وواضحة أثناء العرض.

### أسئلة مقترحة للعرض

- "Where do I collect my badge?"
- "What is the Wi-Fi password?"
- "How many CPD credits are available?"
- "أين أستلم بطاقتي؟"
- "ما هي كلمة مرور الواي فاي؟"
- "أين مكتب المعلومات الطبية؟"

### إذا فشل الميكروفون

إذا ظهرت رسالة `Microphone error: network`، حدّث الصفحة وجرب على شبكة مستقرة. هذه المشكلة مرتبطة بخدمة التعرف على الكلام في المتصفح، وليست بقاعدة معرفة الفعالية.

### إذا كان الصوت العربي غير صحيح

تأكد من تشغيل آخر نسخة منشورة وأن البيئة تحتوي على:

```env
DID_VOICE_ID_AR=ar-SA-HamedNeural
```

إذا تم استخدام صوت المتصفح الاحتياطي، يجب أن يحتوي الجهاز أو المتصفح على صوت عربي مثبت.

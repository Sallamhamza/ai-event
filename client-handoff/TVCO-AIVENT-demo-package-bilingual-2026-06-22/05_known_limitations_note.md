# Known Limitations Note / ملاحظات القيود المعروفة

## English

### Current Demo Limitations

- Browser speech recognition can show `Microphone error: network` if Google speech services are blocked by Wi-Fi, VPN, firewall, or browser settings.
- Arabic speech recognition accuracy depends on the browser, microphone quality, and background noise.
- D-ID avatar speech can introduce delay, especially for Arabic or longer responses.
- The current event content is mock data and must be replaced with approved client/event content before production use.
- The demo does not yet include an admin CMS for event staff to edit knowledge through a dashboard.
- The demo should not answer medical, safety, dosage, adverse-event, patient-specific, or prescribing questions.
- The avatar visual and event persona are demo assets and should be approved by the client before public use.

### Recommended Fixes Before Pilot

- Replace browser speech recognition with server-side speech-to-text for more reliable Arabic and English capture.
- Keep mock/event knowledge answers short for faster Arabic speech delivery.
- Use approved bilingual event content reviewed by TVCO and the client compliance team.
- Add test logs for unanswered questions so the knowledge base can be improved before go-live.
- Run the demo on a stable wired or enterprise Wi-Fi connection.

### Practical Demo Setting

```env
USE_MOCK_AI=true
DID_VOICE_ID=en-US-GuyNeural
DID_VOICE_ID_AR=ar-SA-HamedNeural
```

## العربية

### القيود الحالية في العرض

- قد تظهر رسالة `Microphone error: network` إذا كانت خدمة التعرف على الكلام في المتصفح محجوبة بسبب الشبكة أو VPN أو الجدار الناري أو إعدادات المتصفح.
- دقة التعرف على الكلام العربي تعتمد على المتصفح وجودة الميكروفون والضوضاء المحيطة.
- قد يضيف صوت D-ID بعض التأخير، خصوصًا في العربية أو عند استخدام إجابات طويلة.
- محتوى الفعالية الحالي تجريبي ويجب استبداله بمحتوى معتمد قبل أي استخدام فعلي.
- لا يوجد حتى الآن نظام إدارة محتوى يسمح لفريق الفعالية بتعديل المعرفة من لوحة تحكم.
- يجب ألا يجيب العرض عن الأسئلة الطبية أو أسئلة الجرعات أو السلامة أو الحالات الفردية أو الوصفات.
- صورة المساعد والشخصية المستخدمة في العرض أصول تجريبية ويجب اعتمادها قبل الاستخدام العام.

### تحسينات موصى بها قبل التجربة الأولية

- استبدال التعرف على الكلام داخل المتصفح بخدمة تحويل كلام إلى نص من جهة الخادم لدقة أفضل بالإنجليزية والعربية.
- إبقاء الإجابات قصيرة لتقليل زمن النطق العربي.
- استخدام محتوى ثنائي اللغة معتمد من TVCO وفريق الامتثال لدى العميل.
- إضافة سجل للأسئلة غير المجاب عنها لتحسين قاعدة المعرفة قبل الإطلاق.
- تشغيل العرض على شبكة مستقرة أو اتصال سلكي عند الإمكان.

### إعداد العرض المقترح

```env
USE_MOCK_AI=true
DID_VOICE_ID=en-US-GuyNeural
DID_VOICE_ID_AR=ar-SA-HamedNeural
```

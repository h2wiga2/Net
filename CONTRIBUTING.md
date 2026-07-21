# 🤝 راهنمای مشارکت در WigaNet

از اینکه می‌خواهید در توسعه WigaNet مشارکت کنید، متشکریم! 🎉

## 📋 فهرست

- [نحوه مشارکت](#نحوه-مشارکت)
- [استانداردهای کد](#استانداردهای-کد)
- [فرآیند Pull Request](#فرآیند-pull-request)
- [گزارش باگ](#گزارش-باگ)
- [پیشنهاد ویژگی جدید](#پیشنهاد-ویژگی-جدید)

## 🚀 نحوه مشارکت

### 1. Fork کردن پروژه
```bash
# روی دکمه Fork در GitHub کلیک کنید
```

### 2. Clone کردن
```bash
git clone https://github.com/your-username/wiganet.git
cd wiganet
```

### 3. ساخت Branch جدید
```bash
git checkout -b feature/amazing-feature
```

### 4. انجام تغییرات
- کد خود را بنویسید
- مطمئن شوید استانداردها رعایت شده
- فایل‌های مربوطه را آپدیت کنید

### 5. Commit کردن
```bash
git add .
git commit -m "Add: توضیح تغییرات به فارسی و انگلیسی"
```

**قالب Commit Message:**
```
Add: اضافه کردن ویژگی جدید
Fix: رفع باگ مشخص
Update: بروزرسانی بخشی از کد
Remove: حذف کد غیرضروری
Refactor: بازنویسی کد
Docs: تغییر در مستندات
Style: تغییرات ظاهری CSS
```

### 6. Push کردن
```bash
git push origin feature/amazing-feature
```

### 7. ایجاد Pull Request
- به صفحه GitHub خود بروید
- روی "Pull Request" کلیک کنید
- توضیحات کامل بدهید

## 📝 استانداردهای کد

### HTML
```html
<!-- استفاده از indentation 2 اسپیس -->
<div class="container">
  <article class="card">
    <h3>عنوان</h3>
    <p>متن</p>
  </article>
</div>
```

### CSS
```css
/* استفاده از BEM naming */
.block { }
.block__element { }
.block--modifier { }

/* مرتب‌سازی properties */
.class {
  /* Display & Box Model */
  display: flex;
  width: 100%;
  padding: 10px;
  
  /* Positioning */
  position: relative;
  top: 0;
  
  /* Typography */
  font-size: 14px;
  color: #fff;
  
  /* Visual */
  background: #000;
  border: 1px solid #333;
  
  /* Animation */
  transition: all .3s;
}
```

### JavaScript
```javascript
// استفاده از const/let (نه var)
const myVariable = "value";
let changeable = 0;

// نام‌گذاری camelCase
function myFunction() {
  return true;
}

// استفاده از arrow functions
const calculate = (a, b) => a + b;

// کامنت‌های فارسی برای توضیح
// این تابع برای محاسبه سرعت است
function calculateSpeed() {
  // منطق محاسبه
}
```

### انیمیشن‌ها
```css
/* استفاده از @keyframes با نام‌های توصیفی */
@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

/* استفاده از transition برای حالت‌های ساده */
.button {
  transition: transform .3s ease, background .3s ease;
}

.button:hover {
  transform: translateY(-2px);
}
```

## 🔍 فرآیند Pull Request

### قبل از ارسال PR:
- [ ] کد را تست کنید
- [ ] مطمئن شوید که باگی وجود ندارد
- [ ] Console را بررسی کنید (نباید خطا داشته باشد)
- [ ] در موبایل و دسکتاپ تست کنید
- [ ] README را در صورت نیاز آپدیت کنید

### در توضیحات PR بنویسید:
```markdown
## تغییرات انجام شده
- لیست تغییرات

## نوع تغییر
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## چک‌لیست
- [ ] کد تست شده است
- [ ] مستندات بروز شده
- [ ] بدون خطای Console
```

## 🐛 گزارش باگ

برای گزارش باگ، یک Issue با این فرمت ایجاد کنید:

```markdown
**شرح باگ:**
توضیح دقیق باگ

**مراحل بازتولید:**
1. برو به '...'
2. کلیک روی '...'
3. مشاهده خطا

**رفتار مورد انتظار:**
چه اتفاقی باید می‌افتاد

**Screenshots:**
در صورت امکان عکس اضافه کنید

**محیط:**
- مرورگر: [Chrome 120]
- سیستم‌عامل: [Windows 11]
- نسخه: [1.0.0]
```

## 💡 پیشنهاد ویژگی جدید

```markdown
**ویژگی پیشنهادی:**
توضیح ویژگی

**چرا این ویژگی مفید است؟**
دلیل

**پیشنهاد پیاده‌سازی:**
نحوه پیاده‌سازی (اختیاری)

**مثال‌ها:**
مثال از سایت‌های دیگر (اختیاری)
```

## 🎨 راهنمای استایل

### رنگ‌ها
```css
--bg: #080a0e;           /* پس‌زمینه اصلی */
--panel: #101319;        /* پنل‌ها */
--orange: #ff5a1f;       /* رنگ اصلی */
--green: #35d07f;        /* موفقیت */
--red: #ff4d5e;          /* خطا */
```

### فونت‌ها
- اصلی: Vazirmatn
- Monospace: Arial (برای اعداد)

### Animations
- سرعت پیش‌فرض: `.3s ease`
- Loading: `.7s linear infinite`

## 📞 ارتباط

اگه سوالی دارید:
- 💬 Telegram: [@hwwigas](https://t.me/hwwigas)
- 📱 SMS: 0938 716 0092

---

**ممنون از مشارکت شما! ❤️**

حامد عبدالهی (ویگا) | Hamed Abdollahi (Wiga)

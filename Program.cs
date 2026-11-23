using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace Decorte
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            bool created;
            using (var mutex = new Mutex(true, "Decorte.SingleInstance", out created))
            {
                if (!created) return;
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                Application.Run(new MainForm());
            }
        }
    }

    static class Ui
    {
        public static readonly Color Bg = Color.FromArgb(5, 6, 12);

        public static float Scale()
        {
            using (var g = Graphics.FromHwnd(IntPtr.Zero)) return g.DpiX / 96f;
        }

        public static void SetIcon(Form f)
        {
            try { f.Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }
        }
    }

    class MainForm : Form
    {
        // La interfaz llama a window.Android.printHtml(html, titulo): aquí se reenvía al programa.
        const string Bridge =
            "window.Android={printHtml:function(h,t){window.chrome.webview.postMessage('PRINT:'+String(h));}};";

        readonly WebView2 web;
        CoreWebView2Environment env;

        public MainForm()
        {
            Text = "Decorte";
            BackColor = Ui.Bg;
            Ui.SetIcon(this);

            float s = Ui.Scale();
            Rectangle wa = Screen.PrimaryScreen.WorkingArea;
            int w = Math.Min((int)(560 * s), wa.Width);
            int h = Math.Min((int)(900 * s), (int)(wa.Height * 0.94));
            ClientSize = new Size(w, h);
            MinimumSize = new Size((int)(420 * s), (int)(640 * s));
            StartPosition = FormStartPosition.CenterScreen;

            web = new WebView2();
            web.Dock = DockStyle.Fill;
            web.DefaultBackgroundColor = Ui.Bg;
            Controls.Add(web);

            Load += async (o, e) => await StartAsync();
        }

        async Task StartAsync()
        {
            try
            {
                string data = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "Decorte", "WebView2");
                env = await CoreWebView2Environment.CreateAsync(null, data, null);
                await web.EnsureCoreWebView2Async(env);

                CoreWebView2 c = web.CoreWebView2;
                c.Settings.AreDevToolsEnabled = false;
                c.Settings.AreDefaultContextMenusEnabled = false;
                c.Settings.IsStatusBarEnabled = false;
                c.Settings.IsZoomControlEnabled = false;
                c.Settings.AreBrowserAcceleratorKeysEnabled = false;

                c.SetVirtualHostNameToFolderMapping(
                    "decorte.local",
                    Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "app"),
                    CoreWebView2HostResourceAccessKind.Allow);

                await c.AddScriptToExecuteOnDocumentCreatedAsync(Bridge);
                c.WebMessageReceived += OnMessage;
                c.NewWindowRequested += OnNewWindow;
                c.Navigate("https://decorte.local/index.html");
            }
            catch (Exception ex)
            {
                var r = MessageBox.Show(
                    "Decorte necesita Microsoft Edge WebView2 y no se pudo iniciar.\n\n" + ex.Message +
                    "\n\n¿Abrir la página de descarga de WebView2?",
                    "Decorte", MessageBoxButtons.YesNo, MessageBoxIcon.Warning);
                if (r == DialogResult.Yes)
                {
                    try { Process.Start("https://developer.microsoft.com/microsoft-edge/webview2/"); } catch { }
                }
                Close();
            }
        }

        void OnMessage(object sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            string m;
            try { m = e.TryGetWebMessageAsString(); } catch { return; }
            if (m != null && m.StartsWith("PRINT:", StringComparison.Ordinal))
                new PrintForm(env, m.Substring(6)).Show(this);
        }

        void OnNewWindow(object sender, CoreWebView2NewWindowRequestedEventArgs e)
        {
            e.Handled = true;
            string u = e.Uri ?? "";
            if (u.StartsWith("http://", StringComparison.OrdinalIgnoreCase) ||
                u.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            {
                try { Process.Start(u); } catch { }
            }
        }
    }

    // Ventana con el informe: abre la vista previa de impresión (impresoras o «Guardar como PDF»)
    class PrintForm : Form
    {
        readonly WebView2 web;
        readonly CoreWebView2Environment env;
        readonly string html;
        bool shown;

        public PrintForm(CoreWebView2Environment env, string html)
        {
            this.env = env;
            this.html = html;
            Text = "Imprimir · Decorte";
            BackColor = Ui.Bg;
            Ui.SetIcon(this);
            float s = Ui.Scale();
            Rectangle wa = Screen.PrimaryScreen.WorkingArea;
            ClientSize = new Size(Math.Min((int)(980 * s), wa.Width), Math.Min((int)(820 * s), (int)(wa.Height * 0.94)));
            StartPosition = FormStartPosition.CenterParent;

            web = new WebView2();
            web.Dock = DockStyle.Fill;
            web.DefaultBackgroundColor = Color.White;
            Controls.Add(web);
            Load += async (o, e) => await StartAsync();
        }

        async Task StartAsync()
        {
            try
            {
                await web.EnsureCoreWebView2Async(env);
                CoreWebView2 c = web.CoreWebView2;
                c.Settings.AreDevToolsEnabled = false;
                c.Settings.AreDefaultContextMenusEnabled = false;
                c.NavigationCompleted += (s, a) =>
                {
                    if (shown) return;
                    shown = true;
                    BeginInvoke((Action)(() =>
                    {
                        try { c.ShowPrintUI(CoreWebView2PrintDialogKind.Browser); } catch { }
                    }));
                };
                c.NavigateToString(html);
            }
            catch (Exception ex)
            {
                MessageBox.Show("No se pudo preparar la impresión.\n\n" + ex.Message, "Decorte",
                    MessageBoxButtons.OK, MessageBoxIcon.Warning);
                Close();
            }
        }
    }
}

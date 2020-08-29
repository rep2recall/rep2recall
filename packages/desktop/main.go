package main

import (
	"fmt"
	"io/ioutil"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
	"runtime"
	// #if defined(__APPLE__)
	// #cgo LDFLAGS: -framework CoreGraphics
	// #include <CoreGraphics/CGDisplayConfiguration.h>
	// int display_width() {
	// 	return CGDisplayPixelsWide(CGMainDisplayID());
	// }
	// int display_height() {
	// 	return CGDisplayPixelsHigh(CGMainDisplayID());
	// }
	// #endif
	"C"

	"github.com/webview/webview"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "24000"
	}

	listener, err := net.Listen("tcp", "localhost:"+port)
	if err != nil {
		log.Fatal(err)
	}

	http.Handle("/", http.FileServer(http.Dir("./dist")))
	http.HandleFunc("/api/file", func(w http.ResponseWriter, r *http.Request) {
		f := r.URL.Query()["filename"]
		if len(f) == 0 {
			throwHTTP(&w, fmt.Errorf("filename not supplied"), http.StatusNotFound)
			return
		}
		filename := f[0]

		if r.Method == "GET" {
			data, eReadFile := ioutil.ReadFile(filename)
			if eReadFile != nil {
				throwHTTP(&w, eReadFile, http.StatusInternalServerError)
				return
			}
			w.Write(data)
			return
		} else if r.Method == "PUT" {
			data, eReadAll := ioutil.ReadAll(r.Body)
			if eReadAll != nil {
				throwHTTP(&w, eReadAll, http.StatusInternalServerError)
				return
			}
			eWriteFile := ioutil.WriteFile(filename, data, 0666)
			if eWriteFile != nil {
				throwHTTP(&w, eWriteFile, http.StatusInternalServerError)
				return
			}
			w.WriteHeader(http.StatusCreated)
			return
		} else if r.Method == "DELETE" {
			eRemove := os.Remove(filename)
			if eRemove != nil {
				throwHTTP(&w, eRemove, http.StatusInternalServerError)
				return
			}
			w.WriteHeader(http.StatusCreated)
			return
		}

		throwHTTP(&w, fmt.Errorf("unsupported method"), http.StatusNotFound)
	})

	width := 1024
	height := 768

	if runtime.GOOS == "darwin" {
		width = int(C.display_width())
		height = int(C.display_height())
	}

	w := webview.New(webview.Settings{
		Title: "Rep2recall",
		Debug: false,
		Width: width,
		Height: height,
		Resizable: true,
	})

	if runtime.GOOS != "darwin" {
		w.SetFullscreen(true)
	}

	signals := make(chan os.Signal, 1)
	signal.Notify(signals, os.Interrupt, syscall.SIGTERM)

	go func() {
		<-signals
		onExit()
		w.Exit()
	}()

	url := "http://" + listener.Addr().String()

	go func() {
		log.Println("Listening at:", url)
		if err := http.Serve(listener, nil); err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}()

	w.Dispatch(func() {
		for {
			time.Sleep(1 * time.Second)
			_, err := http.Head(url)
			if err == nil {
				break
			}
		}
		w.Eval(fmt.Sprintf("location.href = '%s'", url))
	})

	log.Println("Opening webview")
	w.Run()
	onExit()
}

func onExit() {
	log.Println("Running onExit")
	time.Sleep(2 * time.Second)
	log.Println("Closing...")
}

func throwHTTP(w *http.ResponseWriter, e error, code int) {
	http.Error(*w, e.Error(), code)
	log.Println(e, code)
}

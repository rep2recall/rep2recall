package main

import (
	"context"
	"fmt"
	"io/ioutil"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
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

	go func() {
		log.Println("Listening at:", "http://"+listener.Addr().String())
		if err := http.Serve(listener, nil); err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}()

	// Cleaning up should be done in 10 seconds
	onExit(10 * time.Second)
}

func onExit(timeout time.Duration) {
	signals := make(chan os.Signal, 1)
	signal.Notify(signals, os.Interrupt, syscall.SIGTERM)

	<-signals

	log.Println("Cleaning up...")

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	// onExit proper
	func() {
		time.Sleep(2 * time.Second)
	}()

	if _, ok := ctx.Deadline(); ok {
		log.Println("Clean-up finished. Closing...")
		// secs := (time.Until(deadline) + time.Second/2) / time.Second
		// log.Printf("Clean-up finished %ds before deadline\n", secs)
	} else {
		log.Fatal(fmt.Sprintf("Clean-up timeout. Not finished within %ds.", timeout/time.Second))
	}
}

func throwHTTP(w *http.ResponseWriter, e error, code int) {
	http.Error(*w, e.Error(), code)
	log.Println(e, code)
}

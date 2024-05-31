async function loadDocuments() {
	let loaderTimeout = setTimeout(showLoader, 2000); // Запуск анимации через 2 секунды
	await loadDocumentsByStatus("Ожидание", "pendingDocuments");
	await loadDocumentsByStatus("Подписанный", "approvedDocuments");
	await loadDocumentsByStatus("Отклонённый", "rejectedDocuments");
	clearTimeout(loaderTimeout); // Отмена таймера, если операция завершена до истечения 2 секунд
	hideLoader();
}

document.addEventListener("DOMContentLoaded", function () {
	loadFooter();
	const pageTitle = document.getElementById("pageTitle");
	pageTitle.addEventListener("click", function () {
		window.location.href = "/archive";
	});

	const uploadForm = document.getElementById("uploadForm");
	const docxFileInput = document.createElement("input");
	docxFileInput.type = "file";
	docxFileInput.style.display = "none";
	docxFileInput.name = "docxFile";
	docxFileInput.required = true;
	uploadForm.appendChild(docxFileInput);

	const dropZone = document.getElementById("dropZone");
	dropZone.addEventListener("dragover", (event) => {
		event.preventDefault();
		dropZone.classList.add("dragover");
	});
	dropZone.addEventListener("dragleave", () => {
		dropZone.classList.remove("dragover");
	});
	dropZone.addEventListener("drop", (event) => {
		event.preventDefault();
		dropZone.classList.remove("dragover");
		const files = event.dataTransfer.files;
		if (files.length > 0) {
			handleFile(files[0]);
		}
	});
	dropZone.addEventListener("click", () => {
		docxFileInput.click();
	});
	docxFileInput.addEventListener("change", () => {
		if (docxFileInput.files.length > 0) {
			handleFile(docxFileInput.files[0]);
		} else {
			dropZone.textContent =
				"Перетащите файлы .DOCX сюда или нажмите для выбора";
		}
	});

	uploadForm.addEventListener("submit", async function (event) {
		event.preventDefault();
		const formData = new FormData();
		if (docxFileInput.files.length > 0) {
			formData.append("docxFile", docxFileInput.files[0]);
			const response = await fetch("/document-management/upload", {
				method: "POST",
				body: formData,
			});
			if (response.ok) {
				loadDocuments();
				docxFileInput.value = "";
				dropZone.textContent =
					"Перетащите файлы .DOCX сюда или нажмите для выбора";
			} else {
				alert("Ошибка при загрузке файла");
			}
		} else {
			alert("Пожалуйста, выберите файл для загрузки");
		}
	});

	function handleFile(file) {
		if (file.name.endsWith(".docx")) {
			dropZone.textContent = file.name;
		} else {
			showErrorBanner();
			docxFileInput.value = "";
			dropZone.textContent =
				"Перетащите файлы .DOCX сюда или нажмите для выбора";
		}
	}

	function showErrorBanner() {
		const banner = document.getElementById("errorBanner");
		banner.style.display = "block";
		banner.style.opacity = "1";
		setTimeout(() => {
			banner.style.opacity = "0";
			setTimeout(() => {
				banner.style.display = "none";
			}, 1000); // Время затухания должно совпадать с transition в CSS
		}, 2000); // Время показа баннера перед началом затухания
	}

	loadDocuments();
});

async function archiveDocument(id) {
	const response = await fetch(`/document-management/archive/${id}`, {
		method: "POST",
	});
	if (response.ok) {
		loadDocuments();
	} else {
		alert("Ошибка при перемещении документа в архив");
	}
}

async function showDocumentDetails(id) {
	const response = await fetch(`/document-management/documents/${id}`);
	if (response.ok) {
		const documentData = await response.json();
		document.getElementById("documentTitle").textContent =
			documentData.title;
		document.getElementById("documentModal").dataset.documentId = id;
		document.getElementById("documentProperties").innerHTML =
			formatMetadata(JSON.parse(documentData.properties));
		document.getElementById("documentMetadata").innerHTML = formatMetadata(
			JSON.parse(documentData.metadata),
		);
		document.getElementById("documentContent").textContent =
			documentData.content;

		// Очистка содержимого блока комментариев перед добавлением новой информации
		const commentsContainer = document.getElementById("documentComments");
		commentsContainer.innerHTML = "";

		// Проверка статуса документа
		const commentsWrapper = document.getElementById("commentsContainer");
		if (
			documentData.status === "Ожидание" ||
			documentData.status === "Подписанный"
		) {
			commentsWrapper.style.display = "none";
		} else {
			commentsWrapper.style.display = "block";
			// Загрузка комментариев
			const commentsResponse = await fetch(
				`/document-management/documents/${id}/comments`,
			);
			if (commentsResponse.ok) {
				const comments = await commentsResponse.json();
				comments.forEach((comment) => {
					const commentItem = document.createElement("li");
					commentItem.innerHTML = `<strong>${comment.author}</strong> (${comment.commentDate}): ${comment.comment}`;
					commentsContainer.appendChild(commentItem);
				});
			} else {
				commentsContainer.innerHTML =
					"<li>Ошибка при загрузке комментариев</li>";
			}
		}

		// Очистка содержимого блока подписи перед добавлением новой информации
		const signatureDetails = document.getElementById("signatureDetails");
		signatureDetails.innerHTML = "";

		const signatureTypeContainer = document.createElement("div");
		signatureTypeContainer.className = "signature-type-container";

		const signatureType = document.createElement("p");
		signatureType.className = "signature-type";

		const signatureLogo = document.createElement("img");
		signatureLogo.src = "../media/MIREA_logo.png";
		signatureLogo.alt = "MIREA Logo";
		signatureLogo.className = "signature-logo";

		signatureTypeContainer.appendChild(signatureLogo);
		signatureTypeContainer.appendChild(signatureType);
		signatureDetails.appendChild(signatureTypeContainer);

		if (documentData.signatureId) {
			const signatureResponse = await fetch(
				`/document-management/signatures/${documentData.signatureId}`,
			);
			if (signatureResponse.ok) {
				const signatureData = await signatureResponse.json();
				let signatureTypeText;
				switch (signatureData.type) {
					case "ПЭП":
						signatureTypeText =
							"ДОКУМЕНТ ПОДПИСАН ПРОСТОЙ ЭЛЕКТРОННОЙ ПОДПИСЬЮ";
						break;
					case "УНЭП":
						signatureTypeText =
							"ДОКУМЕНТ ПОДПИСАН УСИЛЕННОЙ НЕКВАЛИФИЦИРОВАННОЙ ЭЛЕКТРОННОЙ ПОДПИСЬЮ";
						break;
					case "УКЭП":
						signatureTypeText =
							"ДОКУМЕНТ ПОДПИСАН УСИЛЕННОЙ КВАЛИФИЦИРОВАННОЙ ЭЛЕКТРОННОЙ ПОДПИСЬЮ";
						break;
					default:
						signatureTypeText =
							"ДОКУМЕНТ ПОДПИСАН НЕИЗВЕСТНОЙ ПОДПИСЬЮ";
				}
				signatureType.innerHTML = `<strong>${signatureTypeText}</strong>`;
				signatureDetails.innerHTML += `
                    <p><strong>Номер сертификата:</strong> ${signatureData.certificateNumber}</p>
                    <p><strong>Владелец:</strong> ${signatureData.owner}</p>
                    <p><strong>Действителен с:</strong> ${signatureData.validFrom}</p>
                    <p><strong>по:</strong> ${signatureData.validTo}</p>
                `;
			} else {
				signatureType.textContent =
					"Ошибка при загрузке данных подписи";
			}
		} else {
			signatureType.textContent = "Не подписано";
		}

		document.getElementById("documentModal").style.display = "block";
	} else {
		alert("Ошибка при получении информации о документе");
	}
}

function formatMetadata(metadata) {
	return Object.entries(metadata)
		.map(([key, value]) => {
			if (Array.isArray(value)) {
				return `<li>${key}: [${value.join(", ")}]</li>`;
			}
			return `<li>${key}: ${value}</li>`;
		})
		.join("");
}

// Функция для закрытия модального окна при клике вне его области
function closeModalOnClickOutside(event) {
	const modals = document.querySelectorAll(".modal");
	modals.forEach((modal) => {
		if (event.target === modal) {
			modal.style.display = "none";
		}
	});
}

// Добавление обработчика событий для закрытия модальных окон при клике вне их области
document.addEventListener("click", closeModalOnClickOutside);

// Существующие функции для закрытия модальных окон по крестику
function closeDocumentModal() {
	document.getElementById("documentModal").style.display = "none";
}

function closeSignatureModal() {
	document.getElementById("signatureModal").style.display = "none";
}

document.addEventListener("DOMContentLoaded", function () {
	loadDocuments();
});

async function loadDocumentsByStatus(status, containerId) {
	const response = await fetch(
		`/document-management/documents/status/${status}`,
	);
	if (response.ok) {
		const documents = await response.json();
		const container = document.getElementById(containerId);
		container.innerHTML = "";
		documents.forEach((doc) => {
			const docCard = createDocumentCard(doc);
			container.appendChild(docCard);
		});
	} else {
		alert("Ошибка при загрузке документов");
	}
}

async function signDocument(id) {
	const signatureModal = document.getElementById("signatureModal");
	const signatureForm = document.getElementById("signatureForm");

	signatureForm.onsubmit = async function (event) {
		event.preventDefault();
		const formData = new FormData(signatureForm);
		const data = {
			certificateNumber: formData.get("certificateNumber"),
			owner: formData.get("owner"),
			validFrom: formData.get("validFrom"),
			validTo: formData.get("validTo"),
			type: formData.get("type"),
		};

		const response = await fetch(`/document-management/sign/${id}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(data),
		});

		if (response.ok) {
			loadDocuments();
			closeSignatureModal();
		} else {
			alert("Ошибка при подписании документа");
		}
	};

	// Добавляем обработчик события для клавиши Enter
	signatureForm.addEventListener("keydown", function (event) {
		if (event.key === "Enter") {
			event.preventDefault();
			signatureForm.onsubmit(event);
		}
	});

	signatureModal.style.display = "block";
}

function closeSignatureModal() {
	document.getElementById("signatureModal").style.display = "none";
}

async function rejectDocument(id) {
	const response = await fetch(`/document-management/reject/${id}`, {
		method: "POST",
	});
	if (response.ok) {
		loadDocuments();
	} else {
		alert("Ошибка при отклонении документа");
	}
}

async function revokeDocument(id) {
	const response = await fetch(`/document-management/revoke/${id}`, {
		method: "POST",
	});
	if (response.ok) {
		loadDocuments();
	} else {
		alert("Ошибка при отзыве документа");
	}
}

document.addEventListener("DOMContentLoaded", function () {
	loadDocuments();
	setupRejectForm();
});

function setupRejectForm() {
	const rejectForm = document.getElementById("rejectForm");
	rejectForm.onsubmit = async function (event) {
		event.preventDefault();
		const formData = new FormData(rejectForm);
		const data = {
			author: formData.get("author"),
			comment: formData.get("comment"),
		};
		const documentId = rejectForm.dataset.documentId;

		const response = await fetch(
			`/document-management/reject/${documentId}`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(data),
			},
		);

		if (response.ok) {
			loadDocuments();
			closeRejectModal();
		} else {
			alert("Ошибка при отклонении документа");
		}
	};

	// Добавляем обработчик события для клавиши Enter
	rejectForm.addEventListener("keydown", function (event) {
		if (event.key === "Enter") {
			event.preventDefault();
			rejectForm.onsubmit(event);
		}
	});
}

function openRejectModal(documentId) {
	const rejectForm = document.getElementById("rejectForm");
	rejectForm.dataset.documentId = documentId;
	document.getElementById("rejectModal").style.display = "block";
}

function closeRejectModal() {
	document.getElementById("rejectModal").style.display = "none";
}

async function reviewDocument(id) {
	const response = await fetch(`/document-management/review/${id}`, {
		method: "POST",
	});
	if (response.ok) {
		loadDocuments();
	} else {
		alert("Ошибка при пересмотре документа");
	}
}

async function destroyDocument(id) {
	const response = await fetch(`/document-management/destroy/${id}`, {
		method: "POST",
	});
	if (response.ok) {
		loadDocuments();
	} else {
		alert("Ошибка при уничтожении документа");
	}
}

async function archiveDocument(id) {
	const response = await fetch(`/document-management/archive/${id}`, {
		method: "POST",
	});
	if (response.ok) {
		loadDocuments();
	} else {
		alert("Ошибка при перемещении документа в архив");
	}
}

function createDocumentCard(doc) {
	const docCard = document.createElement("div");
	docCard.className = "document-card";
	docCard.innerHTML = `
        <p class="document-filename">${doc.filename}</p>
    `;

	const buttonContainer = document.createElement("div");
	buttonContainer.className = "button-container";

	if (doc.status === "Ожидание") {
		buttonContainer.innerHTML += `
            <button class="sign-button" onclick="signDocument(${doc.id})">Подписать</button>
            <button class="reject-button" onclick="openRejectModal(${doc.id})">Отклонить</button>
            <button class="details-button" onclick="showDocumentDetails(${doc.id})">Подробнее</button>
        `;
	} else if (doc.status === "Подписанный") {
		buttonContainer.innerHTML += `
            <button class="approve-button" onclick="archiveDocument(${doc.id})">Утвердить</button>
            <button class="revoke-button" onclick="revokeDocument(${doc.id})">Отозвать</button>
            <button class="details-button" onclick="showDocumentDetails(${doc.id})">Подробнее</button>
        `;
	} else if (doc.status === "Отклонённый") {
		buttonContainer.innerHTML += `
            <button class="review-button" onclick="reviewDocument(${doc.id})">Пересмотреть</button>
            <button class="details-button" onclick="showDocumentDetails(${doc.id})">Подробнее</button>
            <button class="archive-button" onclick="archiveDocument(${doc.id})">В Архив</button>
            <button class="destroy-button" onclick="destroyDocument(${doc.id})">Уничтожить</button>
        `;
	}

	docCard.appendChild(buttonContainer);
	return docCard;
}

// Функция для начала редактирования заголовка документа
function editDocumentTitle() {
	const documentTitle = document.getElementById("documentTitle").textContent;
	document.getElementById("newDocumentTitle").value = documentTitle;
	document.getElementById("documentTitleContainer").style.display = "none";
	document.getElementById("editTitleContainer").style.display = "flex";
}

// Функция для подтверждения изменения заголовка документа
async function confirmEditTitle() {
	const newTitle = document.getElementById("newDocumentTitle").value;
	const documentId =
		document.getElementById("documentModal").dataset.documentId;

	// Обновление заголовка в базе данных
	const response = await fetch(
		`/document-management/update-title/${documentId}`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ title: newTitle }),
		},
	);

	if (response.ok) {
		document.getElementById("documentTitle").textContent = newTitle;
		cancelEditTitle();
	} else {
		alert("Ошибка при обновлении заголовка документа");
	}
}

// Добавляем обработчик события для клавиши Enter
document
	.getElementById("newDocumentTitle")
	.addEventListener("keydown", function (event) {
		if (event.key === "Enter") {
			event.preventDefault();
			confirmEditTitle();
		}
	});

// Функция для отмены редактирования заголовка документа
function cancelEditTitle() {
	document.getElementById("documentTitleContainer").style.display = "flex";
	document.getElementById("editTitleContainer").style.display = "none";
}

async function updateDocumentStatus(id, newStatus) {
	const response = await fetch(`/document-management/update-status/${id}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ status: newStatus }),
	});
	if (response.ok) {
		loadDocuments();
	} else {
		alert("Ошибка при обновлении статуса");
	}
}

async function loadFooter() {
	const footerContainer = document.getElementById("footerContainer");
	try {
		const response = await fetch("../common/footer.html");
		if (response.ok) {
			const footerHTML = await response.text();
			footerContainer.innerHTML = footerHTML;
		} else {
			console.error("Ошибка при загрузке footer");
		}
	} catch (error) {
		console.error("Ошибка при загрузке footer:", error);
	}
}

// Функция для отображения анимации загрузки
function showLoader() {
	document.getElementById("loaderContainer").style.display = "flex";
}

// Функция для скрытия анимации загрузки
function hideLoader() {
	document.getElementById("loaderContainer").style.display = "none";
}

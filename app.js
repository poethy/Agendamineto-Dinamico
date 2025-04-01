const procedimientos = [
    { id: 1, nombre: 'Cejas', duracion: 30 },
    { id: 2, nombre: 'Ena?', duracion: 45 },
    { id: 3, nombre: 'Pestañas', duracion: 60 }
];

let estado = {
    procedimientoSeleccionado: null,
    fechaSeleccionada: null,
    citas: [],
    horariosBloqueados: new Set()
};

// Horario de trabajo
const HORARIO_INICIO = 9 * 60; // 9:00AM
const HORARIO_FIN = 20 * 60;   // 8:00PM
const HORA_LIMITE_AGENDAMIENTO = 21 * 60; // 9:00PM

document.addEventListener('DOMContentLoaded', () => {
    cargarProcedimientos();
    inicializarCalendario();
    cargarCitasGuardadas();
});

function cargarProcedimientos() {
    const contenedor = document.getElementById('procedimientos-lista');
    procedimientos.forEach(proc => {
        const elemento = document.createElement('div');
        elemento.className = 'procedimiento-item';
        elemento.innerHTML = `
            <h6>${proc.nombre}</h6>
            <small>Duración: ${proc.duracion} minutos</small>
        `;
        elemento.addEventListener('click', () => seleccionarProcedimiento(proc));
        contenedor.appendChild(elemento);
    });
}

function seleccionarProcedimiento(procedimiento) {
    estado.procedimientoSeleccionado = procedimiento;
    document.querySelectorAll('.procedimiento-item').forEach(el => {
        el.classList.remove('seleccionado');
    });
    event.currentTarget.classList.add('seleccionado');
    actualizarCalendario();
}

function inicializarCalendario() {
    const contenedor = document.getElementById('calendario');
    const hoy = new Date();
    
    // Mostrar próximos 7 días
    for (let i = 0; i < 7; i++) {
        const fecha = new Date(hoy);
        fecha.setDate(hoy.getDate() + i);
        
        const diaElemento = document.createElement('div');
        diaElemento.className = 'dia-calendario';
        if (i === 0) diaElemento.classList.add('hoy');
        
        const fechaFormateada = fecha.toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        diaElemento.innerHTML = `
            <h6>${fechaFormateada}</h6>
            <div class="horas-disponibles" data-fecha="${fecha.toISOString()}"></div>
        `;
        
        contenedor.appendChild(diaElemento);
        actualizarHorasDisponibles(fecha);
    }
}

function actualizarHorasDisponibles(fecha) {
    const contenedor = document.querySelector(`[data-fecha="${fecha.toISOString()}"]`);
    contenedor.innerHTML = '';
    
    const esManana = fecha.getDate() === new Date().getDate() + 1;
    const horaActual = new Date();
    const horaActualMinutos = horaActual.getHours() * 60 + horaActual.getMinutes();
    
    // Verificar si se puede agendar para mañana
    if (esManana && horaActualMinutos >= HORA_LIMITE_AGENDAMIENTO) {
        contenedor.innerHTML = '<p class="text-danger">No disponible para agendamiento</p>';
        return;
    }
    
    // Generar slots de tiempo
    for (let hora = HORARIO_INICIO; hora < HORARIO_FIN; hora += 30) {
        const horaFormateada = `${Math.floor(hora/60).toString().padStart(2, '0')}:${(hora%60).toString().padStart(2, '0')}`;
        const slotElemento = document.createElement('span');
        
        if (esSlotDisponible(fecha, hora)) {
            slotElemento.className = 'hora-disponible';
            slotElemento.textContent = horaFormateada;
            slotElemento.addEventListener('click', () => seleccionarHora(fecha, hora));
        } else {
            slotElemento.className = 'hora-no-disponible';
            slotElemento.textContent = horaFormateada;
        }
        
        contenedor.appendChild(slotElemento);
    }
}

function esSlotDisponible(fecha, hora) {
    const fechaHora = new Date(fecha);
    fechaHora.setHours(Math.floor(hora/60), hora%60);
    
    // Verificar si está bloqueado
    if (estado.horariosBloqueados.has(fechaHora.toISOString())) {
        return false;
    }
    
    // Verificar si hay citas que se sobre ponen
    return !estado.citas.some(cita => {
        const citaInicio = new Date(cita.fecha);
        const citaFin = new Date(citaInicio);
        citaFin.setMinutes(citaInicio.getMinutes() + cita.duracion);
        
        return fechaHora >= citaInicio && fechaHora < citaFin;
    });
}

function seleccionarHora(fecha, hora) {
    if (!estado.procedimientoSeleccionado) {
        alert('Por favor, seleccione un procedimiento primero');
        return;
    }
    
    estado.fechaSeleccionada = new Date(fecha);
    estado.fechaSeleccionada.setHours(Math.floor(hora/60), hora%60);
    
    const fechaFormateada = estado.fechaSeleccionada.toLocaleString('es-ES');
    document.getElementById('fecha-seleccionada').textContent = fechaFormateada;
    
    const modal = new bootstrap.Modal(document.getElementById('confirmacionModal'));
    modal.show();
}

// Confirmar cita
document.getElementById('confirmar-cita').addEventListener('click', () => {
    if (estado.fechaSeleccionada && estado.procedimientoSeleccionado) {
        const nuevaCita = {
            fecha: estado.fechaSeleccionada.toISOString(),
            procedimiento: estado.procedimientoSeleccionado.nombre,
            duracion: estado.procedimientoSeleccionado.duracion
        };
        
        estado.citas.push(nuevaCita);
        guardarCitas();
        actualizarCalendario();
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('confirmacionModal'));
        modal.hide();
        
        alert('¡Cita agendada con éxito!');
    }
});

function guardarCitas() {
    localStorage.setItem('citas', JSON.stringify(estado.citas));
}

function cargarCitasGuardadas() {
    const citasGuardadas = localStorage.getItem('citas');
    if (citasGuardadas) {
        estado.citas = JSON.parse(citasGuardadas);
    }
}

function actualizarCalendario() {
    const contenedor = document.getElementById('calendario');
    contenedor.innerHTML = '';
    inicializarCalendario();
}

// Función de testing para borrar todas las citas
document.getElementById('borrar-citas').addEventListener('click', () => {
    if (confirm('¿Está seguro que desea borrar todas las citas? Esta acción no se puede deshacer.')) {
        estado.citas = [];
        localStorage.removeItem('citas');
        actualizarCalendario();
        alert('Todas las citas han sido borradas.');
    }
}); 